#!/usr/bin/env node
/**
 * scripts/aggregate-flakes.mjs ([M3]) — aggregate jest-junit XML
 * files into a "top flakes" markdown table.
 *
 * Usage: `node scripts/aggregate-flakes.mjs <dir>`
 *
 * Walks <dir> recursively for `*.xml` files; expects jest-junit
 * shape:
 *   <testsuites>
 *     <testsuite name="..." tests="..." failures="..." errors="...">
 *       <testcase classname="<filepath>" name="<filepath> :: <test name>">
 *         <failure ...>...</failure>?   <!-- present only on failure -->
 *       </testcase>
 *     </testsuite>
 *   </testsuites>
 *
 * Output: a markdown table with the top 20 flakiest tests, ranked by
 * failure-rate, where a "flake" is a test that has at least ONE pass
 * AND at least ONE fail over the window. Pure failures (always-red)
 * and pure passes are filtered out — they're real regressions or
 * stable tests, not flakes.
 *
 * Implementation note: this script parses XML with a tiny hand-rolled
 * regex extractor rather than pulling a 2MB XML library. The
 * jest-junit shape is small enough that this is robust + dependency-
 * free. The CI workflow uses `actions/setup-node@v4` with no install
 * step.
 *
 * Installed by [M3] — closes #8 of the road-to-10 Test/CI list.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.argv[2];
if (!ROOT) {
  console.error('Usage: aggregate-flakes.mjs <dir>');
  process.exit(1);
}

/** Walk recursively yielding .xml files. */
function* walkXml(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    // Empty / missing dir — caller may have downloaded 0 runs.
    return;
  }
  for (const entry of entries) {
    const abs = join(dir, entry);
    let stat;
    try {
      stat = statSync(abs);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      yield* walkXml(abs);
    } else if (entry.endsWith('.xml')) {
      yield abs;
    }
  }
}

/**
 * Parse one junit XML file. Returns an array of
 * `{ id: string, failed: boolean }`. We extract every <testcase> and
 * mark it failed if it contains a `<failure>` or `<error>` child.
 */
function parseJunit(xmlPath) {
  const xml = readFileSync(xmlPath, 'utf8');
  const out = [];

  // Decode the HTML entities jest-junit emits inside attribute values.
  const decode = (s) =>
    s
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"');

  // Single-pass regex: match the OPENING <testcase ... > (capturing the
  // optional self-closing `/`), then if it was paired, separately
  // capture the body up to </testcase>. Excluding `/<>` from the attr
  // list keeps the matcher from gobbling sibling testcases together.
  // Self-closing path leaves group 3 (body) empty.
  const openRe = /<testcase\b([^<>/]*)(\/?)>/g;
  let m;
  while ((m = openRe.exec(xml))) {
    const attrs = m[1] ?? '';
    const selfClosing = m[2] === '/';
    const classMatch = /\bclassname="([^"]*)"/.exec(attrs);
    const nameMatch = /\bname="([^"]*)"/.exec(attrs);
    if (!classMatch || !nameMatch) continue;
    // The `name` attribute already encodes `<filepath> :: <title>`
    // via jest-junit's titleTemplate; using it directly avoids the
    // duplicated filepath prefix.
    const id = decode(nameMatch[1]);

    let failed = false;
    if (!selfClosing) {
      // Find the matching `</testcase>` from the current position
      // and inspect for a <failure> or <error> child.
      const closeIdx = xml.indexOf('</testcase>', openRe.lastIndex);
      if (closeIdx !== -1) {
        const body = xml.slice(openRe.lastIndex, closeIdx);
        failed = /<failure\b|<error\b/.test(body);
        // Move regex past the close so the next iteration doesn't
        // re-match anything inside this testcase's body.
        openRe.lastIndex = closeIdx + '</testcase>'.length;
      }
    }
    out.push({ id, failed });
  }
  return out;
}

/** runs: map<testId, { pass: number, fail: number }> */
const counts = new Map();

let xmlFileCount = 0;
for (const path of walkXml(ROOT)) {
  xmlFileCount++;
  for (const { id, failed } of parseJunit(path)) {
    const entry = counts.get(id) ?? { pass: 0, fail: 0 };
    if (failed) entry.fail += 1;
    else entry.pass += 1;
    counts.set(id, entry);
  }
}

if (xmlFileCount === 0) {
  process.stdout.write(
    '### Flake Trends — last 10 days\n\nNo junit artifacts found. The `tests` job uploads them per shard.\n',
  );
  process.exit(0);
}

const flakes = [];
for (const [id, { pass, fail }] of counts) {
  const total = pass + fail;
  if (total < 2) continue; // need at least 2 observations to call it flaky
  if (pass === 0 || fail === 0) continue; // pure red / pure green ≠ flake
  flakes.push({ id, pass, fail, total, rate: fail / total });
}

flakes.sort((a, b) => b.rate - a.rate || b.fail - a.fail);
const top = flakes.slice(0, 20);

process.stdout.write('### Flake Trends — last 10 days\n\n');
process.stdout.write(`_Parsed ${xmlFileCount} junit XML file(s) across the window._\n\n`);
if (top.length === 0) {
  process.stdout.write(
    '✅ No flaky tests detected (every test was either always-green or always-red).\n',
  );
  process.exit(0);
}

process.stdout.write('| Rank | Test | Fail / Total | Failure rate |\n');
process.stdout.write('| ---: | :--- | ---: | ---: |\n');
top.forEach((f, i) => {
  // Truncate aggressively — full IDs include the file path; markdown
  // tables break at ~120 columns in the GitHub renderer.
  const shortId = f.id.length > 110 ? `…${f.id.slice(-107)}` : f.id;
  // Escape pipes that would break the markdown table.
  const safe = shortId.replaceAll('|', '\\|');
  process.stdout.write(
    `| ${i + 1} | \`${safe}\` | ${f.fail} / ${f.total} | ${(f.rate * 100).toFixed(1)}% |\n`,
  );
});
process.stdout.write('\n');
process.stdout.write(
  '_A test that fails ≥30% of recent runs is a candidate for quarantine_ ' +
    "_(`apps/api/test/quarantine/`) — see that dir's README for the move-in dance._\n",
);

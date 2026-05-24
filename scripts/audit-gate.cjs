#!/usr/bin/env node
/**
 * Dependency-CVE gate ([I3]).
 *
 * Wraps `pnpm audit` with a clean failure mode + a human-readable
 * summary line that posts to CI logs. Two postures:
 *
 *   --level=critical (BLOCK) — failing here means a CVE was filed
 *     against a transitive dependency that the entire CVSS process
 *     thinks is "exploitable in the wild, fix today." That's our
 *     bar for "the PR can't merge." 0 today.
 *
 *   --level=high (INFORM) — non-blocking; the summary is posted so
 *     reviewers see the backlog without the build failing. 17 today,
 *     mostly transitive @aws-sdk + ws + fast-xml-parser stuff that
 *     requires upstream bumps to clear.
 *
 * Exit codes:
 *   0  — no findings at or above --level
 *   1  — findings at --level (only when --fail-on-finding is set)
 *
 * Installed by [I3].
 */
const { spawnSync } = require('node:child_process');

const args = process.argv.slice(2);
const levelArg = args.find((a) => a.startsWith('--level='));
const level = levelArg ? levelArg.split('=')[1] : 'critical';
const failOnFinding = args.includes('--fail-on-finding');

if (!['low', 'moderate', 'high', 'critical'].includes(level)) {
  process.stderr.write(`audit-gate: bad --level=${level}; expected low|moderate|high|critical\n`);
  process.exit(2);
}

// shell:true required for `pnpm.cmd` on Windows Node 18.20+/20+/22+
// (CVE-2024-27980 hardening blocks .cmd/.bat without it).
const result = spawnSync('pnpm', ['audit', '--json', `--audit-level=${level}`], {
  encoding: 'utf8',
  shell: true,
});

let json;
try {
  json = JSON.parse(result.stdout);
} catch (err) {
  process.stderr.write(
    `audit-gate: pnpm audit returned non-JSON. raw exit=${result.status}\n` +
      `stdout (first 400):\n${result.stdout?.slice(0, 400)}\n` +
      `stderr (first 200):\n${result.stderr?.slice(0, 200)}\n`,
  );
  process.exit(2);
}

const vulns = json.metadata?.vulnerabilities ?? {};
const totals = {
  critical: vulns.critical ?? 0,
  high: vulns.high ?? 0,
  moderate: vulns.moderate ?? 0,
  low: vulns.low ?? 0,
};
const summary = `[audit] critical=${totals.critical} · high=${totals.high} · moderate=${totals.moderate} · low=${totals.low}`;
process.stdout.write(summary + '\n');

// Count findings AT OR ABOVE the requested level.
const order = ['low', 'moderate', 'high', 'critical'];
const threshold = order.indexOf(level);
const aboveThreshold = order.slice(threshold).reduce((sum, sev) => sum + (totals[sev] ?? 0), 0);

if (aboveThreshold === 0) {
  process.stdout.write(`[audit] ✔ no findings at level=${level} or above.\n`);
  process.exit(0);
}

process.stdout.write(
  `[audit] ${aboveThreshold} finding(s) at level=${level} or above. ` +
    `Run \`pnpm audit --audit-level=${level}\` for the table.\n`,
);
process.exit(failOnFinding ? 1 : 0);

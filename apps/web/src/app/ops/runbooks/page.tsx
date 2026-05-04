/**
 * V.UX.38 — runbooks index. Server component that reads
 * `docs/runbooks/*.md` from the repo at request time and renders
 * each with a tiny inline markdown→HTML converter.
 *
 * No new dep — the converter handles the subset the runbooks
 * actually use: ATX headings (# / ## / ###), `inline code`, fenced
 * ```code blocks```, **bold**, *italic*, [links](url), `- ` lists,
 * blank-line paragraphs. Anything richer falls back to plain text.
 *
 * The role gate lives in the wrapping /ops/layout.tsx — this page
 * doesn't re-check.
 *
 * NOTE: For Fly.io deploys the docs/ folder must be copied into the
 * web container. If the readdir fails, the page renders an
 * empty-state with the failure message rather than crashing.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const RUNBOOKS_DIR = path.resolve(process.cwd(), '..', '..', 'docs', 'runbooks');

export const dynamic = 'force-dynamic';

interface Runbook {
  readonly slug: string;
  readonly title: string;
  readonly bodyHtml: string;
}

async function loadRunbooks(): Promise<{ runbooks: Runbook[]; error: string | null }> {
  try {
    const entries = await fs.readdir(RUNBOOKS_DIR);
    const mdFiles = entries.filter((f) => f.endsWith('.md')).sort();
    const runbooks: Runbook[] = [];
    for (const file of mdFiles) {
      const content = await fs.readFile(path.join(RUNBOOKS_DIR, file), 'utf-8');
      const slug = file.replace(/\.md$/, '');
      const title = extractTitle(content) ?? slug.replace(/-/g, ' ');
      runbooks.push({ slug, title, bodyHtml: renderMarkdown(content) });
    }
    return { runbooks, error: null };
  } catch (err) {
    return {
      runbooks: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function extractTitle(md: string): string | null {
  const match = md.match(/^#\s+(.+)$/m);
  return match ? match[1]!.trim() : null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function applyInline(s: string): string {
  // `code`
  let out = s.replace(/`([^`]+)`/g, (_m, c: string) => `<code>${escapeHtml(c)}</code>`);
  // **bold**
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // *italic*
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  // [text](url) — link target restricted to http/https/relative.
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text: string, url: string) => {
    const safe = /^(https?:\/\/|\/|#)/.test(url) ? url : '#';
    return `<a href="${escapeHtml(safe)}" class="underline text-purple-700" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });
  return out;
}

function renderMarkdown(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inCode = false;
  let inList = false;
  let para: string[] = [];

  function flushPara() {
    if (para.length === 0) return;
    out.push(`<p>${applyInline(escapeHtml(para.join(' ')))}</p>`);
    para = [];
  }
  function closeList() {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  }

  for (const raw of lines) {
    const line = raw;

    if (/^\s*```/.test(line)) {
      flushPara();
      closeList();
      if (inCode) {
        out.push('</code></pre>');
        inCode = false;
      } else {
        out.push('<pre class="overflow-x-auto rounded bg-muted/5 p-2 text-xs"><code>');
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      out.push(escapeHtml(line));
      continue;
    }
    if (line.trim() === '') {
      flushPara();
      closeList();
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushPara();
      closeList();
      const level = heading[1]!.length;
      const cls =
        level === 1
          ? 'mt-4 text-2xl font-bold'
          : level === 2
            ? 'mt-4 text-xl font-semibold'
            : 'mt-3 text-base font-semibold';
      out.push(
        `<h${level} class="${cls}">${applyInline(escapeHtml(heading[2]!.trim()))}</h${level}>`,
      );
      continue;
    }
    const bullet = line.match(/^\s*-\s+(.+)$/);
    if (bullet) {
      flushPara();
      if (!inList) {
        out.push('<ul class="ml-5 list-disc space-y-1">');
        inList = true;
      }
      out.push(`<li>${applyInline(escapeHtml(bullet[1]!.trim()))}</li>`);
      continue;
    }
    para.push(line.trim());
  }
  flushPara();
  closeList();
  if (inCode) out.push('</code></pre>');
  return out.join('\n');
}

export default async function OpsRunbooksPage() {
  const { runbooks, error } = await loadRunbooks();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Runbooks</h1>
        <p className="mt-1 text-sm text-muted">
          Operational playbooks bundled from <code>docs/runbooks/</code>. {runbooks.length}{' '}
          documents.
        </p>
      </header>

      {error ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700">
          Could not read runbooks directory: <code>{error}</code>. On Fly.io deploys the{' '}
          <code>docs/runbooks/</code> tree must be copied into the web container.
        </div>
      ) : null}

      {runbooks.length > 0 ? (
        <nav aria-label="Runbook index" className="rounded-md border border-muted/15 p-3">
          <ul className="grid gap-2 sm:grid-cols-2">
            {runbooks.map((r) => (
              <li key={r.slug}>
                <a
                  href={`#${r.slug}`}
                  className="text-sm text-purple-700 underline-offset-2 hover:underline"
                >
                  {r.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {runbooks.map((r) => (
        <article
          key={r.slug}
          id={r.slug}
          className="rounded-md border border-muted/15 bg-surface p-4 prose prose-sm max-w-none dark:prose-invert"
        >
          <p className="text-[11px] uppercase tracking-wide text-muted">
            docs/runbooks/{r.slug}.md
          </p>
          <div dangerouslySetInnerHTML={{ __html: r.bodyHtml }} />
        </article>
      ))}
    </div>
  );
}

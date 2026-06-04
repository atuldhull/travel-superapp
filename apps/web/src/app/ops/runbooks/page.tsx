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
import { BookOpen, FileText } from 'lucide-react';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';

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
    return `<a href="${escapeHtml(safe)}" class="underline text-gold-700 transition hover:text-gold-600 dark:text-gold-300" target="_blank" rel="noopener noreferrer">${text}</a>`;
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
        out.push(
          '<pre class="overflow-x-auto rounded-2xl border border-gold-600/15 bg-gold-500/5 p-3 text-xs"><code>',
        );
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
    <main className="space-y-8">
      {/* Cinematic royal header band — matches /trips + /stays. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <BookOpen aria-hidden className="h-3.5 w-3.5" /> Oncall library
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Runbooks
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Operational playbooks bundled from <code>docs/runbooks/</code> — {runbooks.length}{' '}
          documents, ready when oncall is.
        </p>
      </header>

      {error ? (
        <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Could not read runbooks directory: <code>{error}</code>. On Fly.io deploys the{' '}
          <code>docs/runbooks/</code> tree must be copied into the web container.
        </p>
      ) : null}

      {runbooks.length > 0 ? (
        <Card depth="raised" as="nav" aria-label="Runbook index">
          <CardHeader>
            <CardTitle className="text-xl">Index</CardTitle>
            <CardSubtitle>Jump to any playbook below.</CardSubtitle>
          </CardHeader>
          <ul className="grid gap-2 sm:grid-cols-2">
            {runbooks.map((r) => (
              <li key={r.slug}>
                <a
                  href={`#${r.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-gold-700 underline-offset-4 transition hover:bg-gold-500/10 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/40 dark:text-gold-300"
                >
                  <FileText aria-hidden className="h-3.5 w-3.5" /> {r.title}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {runbooks.map((r) => (
        <article
          key={r.slug}
          id={r.slug}
          className="rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25 prose prose-sm max-w-none dark:prose-invert"
        >
          <p className="font-display text-[11px] uppercase tracking-wide text-gold-700 dark:text-gold-300">
            docs/runbooks/{r.slug}.md
          </p>
          <div dangerouslySetInnerHTML={{ __html: r.bodyHtml }} />
        </article>
      ))}
    </main>
  );
}

/**
 * POST.6 — Tiny markdown → HTML converter used by /terms, /privacy,
 * and /cookies. Scope is deliberately narrow: heading 1-3, paragraphs,
 * unordered lists, bold, italics, inline code, links, blockquotes,
 * and pipe-tables. Anything fancier (images, fenced code with syntax
 * hi, footnotes) is out of scope — legal copy never needs it.
 *
 * Pure server-side; no client bundle cost. Reads the source MD with
 * fs.readFileSync at request time. Output is a string of HTML that
 * the page renders via dangerouslySetInnerHTML, wrapped in a prose-
 * styled <article>.
 *
 * Why hand-rolled instead of `marked` / `react-markdown`: the legal
 * surface is the only consumer; pulling in a parser for 3 pages
 * adds 30+ KB of JS to the build for zero benefit. ~80 lines of
 * regex is auditable + dependency-free.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LEGAL_ROOT = join(process.cwd(), '..', '..', 'docs', 'legal');

/** HTML-escape (in the order: & first, then the others). */
function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Inline transforms applied to every paragraph + list item +
 *  blockquote body. Order matters — code spans first so their
 *  contents never get bold/italic-processed. */
function inline(s: string): string {
  let out = escape(s);
  // Inline code: `foo` (after escape, look for backticks)
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold: **foo**
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic: *foo* (single asterisk, not part of bold)
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  // Links: [text](url)
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_m, text: string, href: string) =>
      `<a href="${escape(href)}" class="underline underline-offset-2 hover:text-brand">${text}</a>`,
  );
  return out;
}

interface BlockSlice {
  readonly kind: 'heading' | 'list' | 'paragraph' | 'blockquote' | 'table' | 'blank';
  readonly lines: string[];
  readonly level?: number;
}

/** Split MD source into block slices. Each slice is rendered
 *  independently. Blank lines separate paragraphs; consecutive
 *  list / quote / table lines stay in one slice. */
function slice(md: string): BlockSlice[] {
  const out: BlockSlice[] = [];
  const lines = md.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      out.push({ kind: 'heading', lines: [heading[2]!], level: heading[1]!.length });
      i++;
      continue;
    }
    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i]!.startsWith('- ')) {
        items.push(lines[i]!.slice(2));
        i++;
      }
      out.push({ kind: 'list', lines: items });
      continue;
    }
    if (line.startsWith('> ')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i]!.startsWith('> ')) {
        quote.push(lines[i]!.slice(2));
        i++;
      }
      out.push({ kind: 'blockquote', lines: quote });
      continue;
    }
    if (line.startsWith('|')) {
      const rows: string[] = [];
      while (i < lines.length && lines[i]!.startsWith('|')) {
        rows.push(lines[i]!);
        i++;
      }
      out.push({ kind: 'table', lines: rows });
      continue;
    }
    // Paragraph — accumulate until blank line or block-start.
    const para: string[] = [];
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]!) &&
      !/^(#{1,3})\s+/.test(lines[i]!) &&
      !lines[i]!.startsWith('- ') &&
      !lines[i]!.startsWith('> ') &&
      !lines[i]!.startsWith('|')
    ) {
      para.push(lines[i]!);
      i++;
    }
    if (para.length > 0) out.push({ kind: 'paragraph', lines: para });
  }
  return out;
}

function renderBlock(b: BlockSlice): string {
  switch (b.kind) {
    case 'heading': {
      const tag = `h${b.level ?? 2}`;
      // Tailwind prose-like sizing via inline classes.
      const cls =
        b.level === 1
          ? 'text-3xl font-bold mt-8 mb-4'
          : b.level === 2
            ? 'text-xl font-semibold mt-6 mb-3'
            : 'text-base font-semibold mt-4 mb-2';
      return `<${tag} class="${cls}">${inline(b.lines[0] ?? '')}</${tag}>`;
    }
    case 'list': {
      const items = b.lines.map((li) => `<li class="ml-6 list-disc">${inline(li)}</li>`).join('');
      return `<ul class="my-3 space-y-1.5">${items}</ul>`;
    }
    case 'blockquote': {
      const body = inline(b.lines.join(' '));
      return `<blockquote class="my-4 border-l-4 border-amber-500/40 bg-amber-500/5 px-4 py-2 text-sm">${body}</blockquote>`;
    }
    case 'table': {
      // Drop the separator row (|---|---|).
      const rows = b.lines.filter((r) => !/^\|\s*[-: ]+\|/.test(r));
      const [headerRow, ...bodyRows] = rows;
      if (!headerRow) return '';
      const headerCells = headerRow
        .split('|')
        .slice(1, -1)
        .map(
          (c) =>
            `<th class="border border-muted/20 px-3 py-1.5 text-left text-xs">${inline(c.trim())}</th>`,
        )
        .join('');
      const bodyHtml = bodyRows
        .map((r) => {
          const tds = r
            .split('|')
            .slice(1, -1)
            .map(
              (c) =>
                `<td class="border border-muted/15 px-3 py-1.5 text-xs">${inline(c.trim())}</td>`,
            )
            .join('');
          return `<tr>${tds}</tr>`;
        })
        .join('');
      return `<table class="my-4 w-full border-collapse"><thead><tr>${headerCells}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
    }
    case 'paragraph': {
      const body = inline(b.lines.join(' '));
      return `<p class="my-3 leading-relaxed">${body}</p>`;
    }
    case 'blank':
      return '';
  }
}

/** Read `docs/legal/<slug>.md` and return rendered HTML. */
export function renderLegalMarkdown(slug: string): {
  readonly html: string;
  readonly lastUpdated: string;
} {
  const raw = readFileSync(join(LEGAL_ROOT, `${slug}.md`), 'utf8');
  const html = slice(raw).map(renderBlock).join('\n');
  const lastUpdatedMatch = /Last updated:\s*([\d-]+)/i.exec(raw);
  const lastUpdated = lastUpdatedMatch?.[1] ?? 'unknown';
  return { html, lastUpdated };
}

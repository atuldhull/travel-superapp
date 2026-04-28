/**
 * V.UX.12 — live preview pane for the memory-book editor. Embeds
 * `/memory-books/:id?preview=true` in an iframe so the owner sees
 * the book exactly as a public viewer will.
 *
 * Theme changes broadcast to the iframe via `postMessage` so the
 * preview repaints instantly without a network round-trip:
 *   { type: 'memory-book-theme', accent, bg }
 *
 * `reloadKey` is bumped by the parent after structural mutations
 * (asset reorder, caption edit, attach/detach) — incrementing it
 * forces the iframe to re-fetch and re-render.
 *
 * Installed by prompt [V.UX.12].
 */
'use client';

import { useEffect, useRef } from 'react';
import { getThemeBySlug } from './theme-picker';

export interface PreviewPaneProps {
  readonly bookId: string;
  readonly themeSlug: string;
  readonly reloadKey: number;
}

export function PreviewPane({ bookId, themeSlug, reloadKey }: PreviewPaneProps) {
  const ref = useRef<HTMLIFrameElement | null>(null);

  // Push the theme on every change. The iframe listens for the
  // message and swaps CSS variables in-place — no reload needed.
  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    const theme = getThemeBySlug(themeSlug);
    const post = () => {
      iframe.contentWindow?.postMessage(
        { type: 'memory-book-theme', accent: theme.accent, bg: theme.bg },
        window.location.origin,
      );
    };
    // Send on mount + re-send on every theme change. If the
    // iframe hasn't loaded yet, queue a one-shot 'load' listener.
    if (iframe.contentWindow?.document?.readyState === 'complete') {
      post();
    } else {
      iframe.addEventListener('load', post, { once: true });
    }
  }, [themeSlug, reloadKey]);

  const src = `/memory-books/${bookId}?preview=true&v=${reloadKey}`;

  return (
    <div className="flex h-full flex-col rounded-md border border-muted/20 bg-muted/5">
      <div className="flex items-center justify-between border-b border-muted/15 bg-muted/10 px-3 py-2 text-xs text-muted">
        <span>Live preview</span>
        <a
          href={`/memory-books/${bookId}?preview=true`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand hover:underline"
        >
          Open in new tab ↗
        </a>
      </div>
      <iframe
        ref={ref}
        key={reloadKey}
        src={src}
        title="Memory-book live preview"
        className="h-[70vh] w-full flex-1 rounded-b-md bg-background"
      />
    </div>
  );
}

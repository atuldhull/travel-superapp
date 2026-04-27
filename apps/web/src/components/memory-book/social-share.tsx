/**
 * V.UX.11 social-share row. Wraps the Web Share API on devices that
 * support it (one tap → native sheet on iOS / Android), and falls
 * back to copy + per-channel deep links elsewhere.
 *
 * Channels:
 *   - Web Share (native sheet) — only when `navigator.share` exists.
 *   - X / Twitter intent URL.
 *   - WhatsApp `wa.me` URL (works on mobile + desktop web client).
 *   - Copy link to clipboard.
 *
 * Installed by prompt [V.UX.11].
 */
'use client';

import { useState } from 'react';
import { Button } from '../ui/button';

export interface SocialShareProps {
  readonly title: string;
  readonly text: string;
  readonly url: string;
}

type NavigatorWithShare = Navigator & {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
};

export function SocialShare({ title, text, url }: SocialShareProps) {
  const [copied, setCopied] = useState(false);

  async function nativeShare() {
    if (typeof navigator === 'undefined') return;
    const nav = navigator as NavigatorWithShare;
    if (!nav.share) return;
    try {
      await nav.share({ title, text, url });
    } catch {
      // User dismissed the sheet — silent.
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — user can long-press the URL
    }
  }

  const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${text} ${url}`)}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
  const hasNativeShare =
    typeof navigator !== 'undefined' && (navigator as NavigatorWithShare).share !== undefined;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {hasNativeShare ? (
        <Button type="button" variant="outline" size="sm" onClick={nativeShare}>
          📤 Share…
        </Button>
      ) : null}
      <a
        href={tweetHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-md border border-muted/30 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted/10"
      >
        𝕏 Tweet
      </a>
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-500/10 dark:text-emerald-400"
      >
        💬 WhatsApp
      </a>
      <Button type="button" variant="ghost" size="sm" onClick={copy}>
        {copied ? 'Copied!' : '🔗 Copy link'}
      </Button>
    </div>
  );
}

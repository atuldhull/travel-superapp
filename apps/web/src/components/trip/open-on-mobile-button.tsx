/**
 * V.UX.4 desktop-to-phone handoff. Tiny button on `/trips/:id` that
 * pops a modal with a QR code encoding the same trip URL. Scanning
 * with the phone camera takes the user straight to the trip on their
 * device — keeps the casual weekend traveler from re-typing URLs.
 *
 * Pure client. The QR code is rendered offline by `qrcode.react`;
 * no network call. The encoded URL uses `window.location.origin` so
 * QR codes scanned on a LAN dev box still work.
 *
 * Installed by prompt [V.UX.4].
 */
'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../ui/button';

interface OpenOnMobileButtonProps {
  readonly tripId: string;
}

export function OpenOnMobileButton({ tripId }: OpenOnMobileButtonProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Compute on the client only — `window` doesn't exist during SSR.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setUrl(`${window.location.origin}/trips/${tripId}`);
  }, [tripId]);

  // Esc-to-close + body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API blocked (insecure origin / browser denial).
      // Surface nothing — user can long-press the URL text below.
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Open this trip on mobile via QR code"
      >
        📱 Open on phone
      </Button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Open on phone"
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-muted/15 bg-background p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Open on your phone</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Scan with your phone camera to keep planning on the go.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <div className="flex justify-center rounded-md bg-white p-4">
              {url ? (
                <QRCodeSVG value={url} size={208} level="M" includeMargin={false} />
              ) : (
                <div className="h-52 w-52 animate-pulse rounded bg-muted/20" />
              )}
            </div>
            <p className="mt-4 break-all rounded-md bg-muted/10 px-3 py-2 text-center font-mono text-[11px] text-muted">
              {url}
            </p>
            <div className="mt-3 flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={copyUrl}>
                {copied ? 'Copied!' : 'Copy URL'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

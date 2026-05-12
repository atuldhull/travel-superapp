/**
 * V.UX.40 — /demo page. 6-scene auto-advancing scripted tour for the
 * investor / press / casual sceptic. 8s per scene, manual prev/next,
 * pause toggle, ends with a CTA to register.
 *
 * Each scene is a card with a headline + 1-line annotation + a
 * mock-screenshot block. No real screenshots needed — the
 * mock-block summarises what the surface DOES so the demo hits the
 * "wow" without needing a deployed instance.
 */
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface Scene {
  readonly title: string;
  readonly headline: string;
  readonly body: string;
  /** Either a /screenshots/*.svg path or null to fall back to emoji. */
  readonly screenshot: string | null;
  /** Fallback emoji used when no screenshot is available. */
  readonly emoji: string;
}

const SCENES: readonly Scene[] = [
  {
    title: 'Drop a pin · plan in seconds',
    headline: 'One destination. One radius. A full plan.',
    body: 'Pick a place + radius. The agent generates an itinerary in seconds — places, stays, food, transport, weather, scams, language, photo spots.',
    screenshot: '/screenshots/itinerary.svg',
    emoji: '📍',
  },
  {
    title: 'Live re-plan',
    headline: 'Your day shifts; the plan shifts with you.',
    body: 'Stuck in a 90-minute restaurant queue? The day reflows. Festival just popped up nearby? An overlay surfaces it on the date.',
    screenshot: '/screenshots/itinerary.svg',
    emoji: '🔁',
  },
  {
    title: 'Travel safer',
    headline: 'Hold the SOS pill. Trusted contacts notified.',
    body: 'Local 911 numbers for 58 countries. Anonymous viewers get tooltips. Hold-to-confirm prevents accidental triggers.',
    screenshot: '/screenshots/sos.svg',
    emoji: '🆘',
  },
  {
    title: 'Memory books',
    headline: 'Story-mode photo books — public, shareable, portable.',
    body: 'Drag-reorder, captions, themes, social-share. Lightbox. Deep-link OG cards on every share.',
    screenshot: '/screenshots/memory-book.svg',
    emoji: '📔',
  },
  {
    title: 'Privacy-first',
    headline: 'Right-to-erasure shipped. Reactivation within 7 days.',
    body: 'GDPR posture: data export (JSON / NDJSON), full delete with grace window, audit trail on every admin action.',
    screenshot: null,
    emoji: '🛡️',
  },
  {
    title: 'Built-in trust',
    headline: 'Open source. Auditable. SOC2 in progress.',
    body: 'Every admin action is logged. Compliance dashboard surfaces retention + takedowns. Ops dashboard surfaces health probes.',
    screenshot: null,
    emoji: '🔓',
  },
];

const SCENE_MS = 8000;

export default function DemoPage() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = window.setTimeout(() => {
      setIdx((p) => (p + 1) % SCENES.length);
    }, SCENE_MS);
    return () => window.clearTimeout(id);
  }, [idx, paused]);

  const scene = SCENES[idx]!;
  const isLast = idx === SCENES.length - 1;

  return (
    <div className="min-h-[70vh] space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">TravelSuperApp · 60-second tour</h1>
          <p className="text-xs text-muted">
            Scene {idx + 1} of {SCENES.length} · auto-advance every 8s
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="rounded-md border border-muted/15 px-3 py-1 text-xs"
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button
            type="button"
            onClick={() => setIdx((p) => (p - 1 + SCENES.length) % SCENES.length)}
            className="rounded-md border border-muted/15 px-3 py-1 text-xs"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={() => setIdx((p) => (p + 1) % SCENES.length)}
            className="rounded-md border border-muted/15 px-3 py-1 text-xs"
          >
            Next →
          </button>
        </div>
      </header>

      <div className="relative min-h-[60vh] overflow-hidden rounded-2xl border border-muted/15 bg-linear-to-br from-brand-50 via-surface to-amber-50 p-8 shadow-(--shadow-depth-2) dark:from-brand-900/20 dark:via-surface dark:to-amber-900/10">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="grid h-full items-center gap-8 sm:grid-cols-[1fr_1.1fr]"
          >
            {/* Left: copy */}
            <div className="space-y-3 text-center sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand">
                {scene.title}
              </p>
              <h2 className="text-3xl font-bold leading-tight sm:text-4xl">{scene.headline}</h2>
              <p className="max-w-md text-sm text-muted sm:text-base">{scene.body}</p>
              {isLast ? (
                <div className="flex flex-wrap items-center justify-center gap-3 pt-3 sm:justify-start">
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-1.5 rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-(--shadow-depth-2) transition hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-(--shadow-depth-3)"
                  >
                    Get started — it&apos;s free
                  </Link>
                  <Link
                    href="/featured"
                    className="inline-flex items-center gap-1.5 rounded-md border border-brand/40 px-5 py-2.5 text-sm font-semibold text-brand transition hover:-translate-y-0.5 hover:bg-brand/5"
                  >
                    See featured trips
                  </Link>
                </div>
              ) : null}
            </div>

            {/* Right: screenshot or emoji fallback */}
            <div className="flex items-center justify-center">
              {scene.screenshot ? (
                <div className="relative w-full max-w-md overflow-hidden rounded-lg border border-muted/20 shadow-(--shadow-depth-3)">
                  <Image
                    src={scene.screenshot}
                    alt={scene.headline}
                    width={600}
                    height={380}
                    className="h-auto w-full"
                  />
                </div>
              ) : (
                <p className="text-8xl" aria-hidden>
                  {scene.emoji}
                </p>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
          {SCENES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to scene ${i + 1}`}
              onClick={() => setIdx(i)}
              className={`h-1.5 w-8 rounded-full transition ${
                i === idx ? 'bg-brand' : 'bg-muted/30 hover:bg-muted/50'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

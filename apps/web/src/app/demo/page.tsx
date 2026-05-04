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
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface Scene {
  readonly title: string;
  readonly headline: string;
  readonly body: string;
  readonly emoji: string;
}

const SCENES: readonly Scene[] = [
  {
    title: 'Drop a pin',
    headline: 'One destination. One radius. A full plan.',
    body: 'Pick a place + radius. The agent generates an itinerary in seconds — places, stays, food, transport, weather, scams, language, photo spots.',
    emoji: '📍',
  },
  {
    title: 'Live re-plan',
    headline: 'Your day shifts; the plan shifts with you.',
    body: 'Stuck in a 90-minute restaurant queue? The day reflows. Festival just popped up nearby? An overlay surfaces it on the date.',
    emoji: '🔁',
  },
  {
    title: 'Travel safer',
    headline: 'Hold the SOS pill. Trusted contacts notified.',
    body: 'Local 911 numbers for 58 countries. Anonymous viewers get tooltips. Hold-to-confirm prevents accidental triggers.',
    emoji: '🆘',
  },
  {
    title: 'Memory books',
    headline: 'Story-mode photo books — public, shareable, portable.',
    body: 'Drag-reorder, captions, themes, social-share. Lightbox. Deep-link OG cards on every share.',
    emoji: '📔',
  },
  {
    title: 'Privacy-first',
    headline: 'Right-to-erasure shipped. Reactivation within 7 days.',
    body: 'GDPR posture: data export (JSON / NDJSON), full delete with grace window, audit trail on every admin action.',
    emoji: '🛡️',
  },
  {
    title: 'Built-in trust',
    headline: 'Open source. Auditable. SOC2 in progress.',
    body: 'Every admin action is logged. Compliance dashboard surfaces retention + takedowns. Ops dashboard surfaces health probes.',
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

      <div className="relative h-[55vh] overflow-hidden rounded-2xl border border-muted/15 bg-linear-to-br from-brand/10 via-surface to-brand/5 p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="flex h-full flex-col items-center justify-center text-center"
          >
            <p className="text-7xl" aria-hidden>
              {scene.emoji}
            </p>
            <p className="mt-4 text-xs uppercase tracking-widest text-muted">{scene.title}</p>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{scene.headline}</h2>
            <p className="mt-3 max-w-2xl text-sm text-muted sm:text-base">{scene.body}</p>
            {isLast ? (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/register"
                  className="rounded-md bg-brand px-5 py-2 text-sm font-semibold text-white shadow"
                >
                  Get started — it&apos;s free
                </Link>
                <Link
                  href="/featured"
                  className="rounded-md border border-muted/15 px-5 py-2 text-sm font-semibold"
                >
                  See featured trips
                </Link>
              </div>
            ) : null}
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

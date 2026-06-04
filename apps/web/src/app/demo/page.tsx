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
import { ArrowRight, Pause, Play, PlayCircle, Sparkles } from 'lucide-react';
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
    <main className="space-y-8">
      {/* Cinematic royal header band — matches /home + /trips. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
              <PlayCircle aria-hidden className="h-3.5 w-3.5" /> 60-second tour
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              TravelSuperApp
            </h1>
            <p className="mt-2 max-w-lg text-sm text-white/65">
              Scene {idx + 1} of {SCENES.length} · auto-advance every 8s.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? 'Resume tour' : 'Pause tour'}
              className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-gold-300 backdrop-blur-sm transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
            >
              {paused ? (
                <>
                  <Play aria-hidden className="h-3.5 w-3.5" /> Resume
                </>
              ) : (
                <>
                  <Pause aria-hidden className="h-3.5 w-3.5" /> Pause
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setIdx((p) => (p - 1 + SCENES.length) % SCENES.length)}
              aria-label="Previous scene"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => setIdx((p) => (p + 1) % SCENES.length)}
              aria-label="Next scene"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
            >
              Next →
            </button>
          </div>
        </div>
      </header>

      <div className="relative min-h-[60vh] overflow-hidden rounded-2xl border border-gold-600/25 bg-linear-to-br from-gold-500/8 via-surface to-brand/5 p-8 shadow-(--shadow-depth-2)">
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
              <p className="font-display text-xs font-semibold uppercase tracking-widest text-gold-700 dark:text-gold-300">
                {scene.title}
              </p>
              <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-surface-foreground sm:text-4xl">
                {scene.headline}
              </h2>
              <p className="max-w-md text-sm text-muted sm:text-base">{scene.body}</p>
              {isLast ? (
                <div className="flex flex-wrap items-center justify-center gap-3 pt-3 sm:justify-start">
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-brand-900 shadow-(--shadow-glow) transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
                    style={{ backgroundImage: 'var(--gradient-gold)' }}
                  >
                    <Sparkles aria-hidden className="h-4 w-4" /> Get started — it&apos;s free
                  </Link>
                  <Link
                    href="/featured"
                    className="inline-flex items-center gap-2 rounded-full border border-gold-600/30 px-6 py-3 text-sm font-semibold text-surface-foreground transition hover:-translate-y-0.5 hover:bg-gold-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    See featured trips <ArrowRight aria-hidden className="h-4 w-4" />
                  </Link>
                </div>
              ) : null}
            </div>

            {/* Right: screenshot or emoji fallback */}
            <div className="flex items-center justify-center">
              {scene.screenshot ? (
                <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-gold-600/25 shadow-(--shadow-depth-3)">
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
              className={`h-1.5 w-8 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                i === idx ? 'bg-gold-500' : 'bg-muted/30 hover:bg-muted/50'
              }`}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

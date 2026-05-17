/**
 * Landing hero — premium "cinematic editorial" rebuild.
 *
 * Deep royal-indigo ground, a champagne-gold aura, Playfair display
 * headline with a gold-foil accent line, glass CTAs, and a floating
 * glass-framed illustration. Motion via framer-motion with a staggered
 * reveal that fully respects `prefers-reduced-motion` (the entire
 * fold is readable without JS — content is in the markup, motion is
 * progressive enhancement only).
 *
 * Client component (motion); copy stays in the DOM so it's SSR-
 * visible + crawlable. Reuses the existing /illustrations/hero.svg.
 */
'use client';

import Link from 'next/link';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { ArrowRight, MoveDown, Sparkles } from 'lucide-react';
import { DestinationImage } from '../ui/destination-image';
import { HERO_DEFAULT_PLACE } from '../../lib/destination-image';

const GOLD_TEXT: React.CSSProperties = {
  backgroundImage: 'var(--gradient-gold)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};

export function LandingHero() {
  const reduce = useReducedMotion();

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.09, delayChildren: 0.05 } },
  };
  const rise: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 22 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
  };

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-16 shadow-(--shadow-depth-3) sm:px-12 sm:py-20"
      style={{ backgroundImage: 'var(--gradient-royal)' }}
    >
      {/* Champagne aura + vignette (decorative). */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-gold-500/25 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-brand-400/20 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_40%,rgba(0,0,0,0.35)_100%)]"
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 grid items-center gap-12 sm:grid-cols-[1.15fr_1fr]"
      >
        <div className="space-y-6">
          <motion.p
            variants={rise}
            className="inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3.5 py-1.5 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm"
          >
            <Sparkles aria-hidden className="h-3.5 w-3.5" />
            Your intelligent travel companion
          </motion.p>

          <motion.h1
            id="hero-heading"
            variants={rise}
            className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            Plan, explore,
            <br />
            stay safe —{' '}
            <span style={GOLD_TEXT} className="italic">
              anywhere you wander.
            </span>
          </motion.h1>

          <motion.p
            variants={rise}
            className="max-w-md text-base leading-relaxed text-white/70 sm:text-lg"
          >
            Name a place. Your companion crafts the itinerary, watches the weather and crowds while
            you travel, and turns the journey into a Memory Book — automatically.
          </motion.p>

          <motion.div variants={rise} className="flex flex-wrap gap-3 pt-1">
            <a
              href="#sample-trip"
              className="group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-brand-900 shadow-(--shadow-glow) transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-900"
              style={{ backgroundImage: 'var(--gradient-gold)' }}
            >
              See a sample trip
              <MoveDown aria-hidden className="h-4 w-4 transition group-hover:translate-y-0.5" />
            </a>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-white/50 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              Start free
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </motion.div>

          <motion.p
            variants={rise}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/55"
          >
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-400" /> Agentic &amp; private
            </span>
            <span className="text-white/25">·</span>
            <span>GDPR / DPDP compliant</span>
            <span className="text-white/25">·</span>
            <span>No card to try</span>
          </motion.p>
        </div>

        {/* Floating glass-framed illustration. */}
        <motion.div
          variants={rise}
          className="relative mx-auto w-full max-w-md"
          animate={reduce ? undefined : { y: [0, -12, 0] }}
          transition={reduce ? undefined : { duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="rounded-3xl border border-gold-500/25 bg-white/5 p-3 shadow-(--shadow-depth-3) backdrop-blur-md">
            <DestinationImage
              place={HERO_DEFAULT_PLACE}
              alt="A breathtaking destination awaiting you"
              priority
              scrim
              rounded="rounded-2xl"
              className="aspect-[4/3] w-full"
            />
            <p className="px-1 pb-1 pt-3 text-center text-xs font-medium tracking-wide text-white/55">
              Real places. Real journeys. Yours to plan.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

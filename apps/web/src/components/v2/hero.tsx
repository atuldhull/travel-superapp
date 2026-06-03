/**
 * v2 hero — the dark, cinematic fold.
 *
 * Full-bleed verified destination photo (graceful royal-gradient
 * fallback, never broken) under layered scrims, the over-hero nav, a
 * Playfair headline with a gold-foil line, a floating white search bar,
 * and the AI Trip Planner panel. The search "Search" button and the
 * panel's "Plan My Trip" both open the live <PlanModal>.
 */
'use client';

import { useState } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { ArrowRight, CalendarDays, Search, Sparkles, Users2 } from 'lucide-react';
import { V2Photo } from './photo';
import { V2Nav } from './nav';
import { PlanModal } from './ai-planner';
import { GOLD_TEXT } from './kit';

const SEARCH_TABS = ['Destinations', 'Experiences', 'Hotels', 'Journeys'] as const;
type SearchTab = (typeof SEARCH_TABS)[number];

// A verified, sweeping photo from the app's own destination data
// (Amber Fort over the lake at dawn) — never a map or a flag.
const HERO_PHOTO_ID = '1477587458883-47465968ef79';

export function V2Hero(): React.ReactElement {
  const reduce = useReducedMotion() ?? false;
  const [destination, setDestination] = useState('');
  const [tab, setTab] = useState<SearchTab>('Destinations');
  const [planOpen, setPlanOpen] = useState(false);

  const rise: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 22 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
  };
  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.09, delayChildren: 0.04 } },
  };

  return (
    <section className="relative isolate min-h-[780px] overflow-hidden bg-brand-900 text-white">
      <div aria-hidden className="absolute inset-0 -z-10">
        <V2Photo
          id={HERO_PHOTO_ID}
          priority
          rounded="rounded-none"
          width={2200}
          className="h-full w-full"
        />
        <div
          className="absolute inset-0"
          style={{ backgroundImage: 'var(--gradient-royal)', opacity: 0.5 }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/60" />
      </div>

      <V2Nav />

      <div className="mx-auto flex min-h-[780px] max-w-7xl flex-col justify-center px-6 pb-20 pt-32">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid items-end gap-8 lg:grid-cols-[1.25fr_0.85fr] lg:gap-12"
        >
          <div>
            <motion.p
              variants={rise}
              className="inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-white/10 px-3.5 py-1.5 text-xs font-medium tracking-wide text-gold-200 backdrop-blur-sm"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> Luxury travel, intelligently planned
            </motion.p>

            <motion.h1
              variants={rise}
              className="mt-5 font-display text-5xl font-semibold leading-[1.04] tracking-tight sm:text-6xl lg:text-[4.6rem]"
            >
              Discover Places
              <br />
              <span style={GOLD_TEXT} className="italic">
                Beyond Imagination
              </span>
            </motion.h1>

            <motion.p
              variants={rise}
              className="mt-5 max-w-md text-base leading-relaxed text-white/90 sm:text-lg"
            >
              Name a place — your companion writes the itinerary, watches weather, crowds and safety
              while you travel, and turns the trip into a Memory Book.
            </motion.p>

            <motion.div variants={rise} className="mt-8 max-w-2xl">
              <div className="flex flex-wrap gap-1 sm:gap-1.5">
                {SEARCH_TABS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    aria-pressed={tab === t}
                    className={
                      tab === t
                        ? 'rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-brand-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 sm:px-4'
                        : 'rounded-full px-3 py-1.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 sm:px-4'
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-white p-2 shadow-(--shadow-depth-3) sm:flex-row sm:items-center">
                <label className="flex flex-1 items-center gap-2.5 px-3 py-2">
                  <Search className="h-4 w-4 shrink-0 text-gold-600" aria-hidden />
                  <input
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setPlanOpen(true);
                    }}
                    placeholder="Where do you want to go?"
                    aria-label="Destination"
                    className="w-full bg-transparent text-sm text-surface-foreground outline-none placeholder:text-muted"
                  />
                </label>
                <div className="hidden items-center gap-2 px-3 text-sm text-muted sm:flex">
                  <span className="h-6 w-px bg-gold-600/15" aria-hidden />
                  <CalendarDays className="h-4 w-4 text-gold-600" aria-hidden />
                  <span className="whitespace-nowrap">Anytime</span>
                  <span className="h-6 w-px bg-gold-600/15" aria-hidden />
                  <Users2 className="h-4 w-4 text-gold-600" aria-hidden />
                  <span className="whitespace-nowrap">2 Guests</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPlanOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-brand-900 shadow-(--shadow-glow) transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
                  style={{ backgroundImage: 'var(--gradient-gold)' }}
                >
                  Search
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </motion.div>
          </div>

          <motion.div
            variants={rise}
            className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/10 p-6 shadow-(--shadow-depth-3) backdrop-blur-md"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full"
              style={{
                background:
                  'radial-gradient(circle at 35% 35%, rgba(224,196,131,0.55), rgba(45,58,115,0.35) 55%, transparent 72%)',
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full border border-gold-300/30"
            />
            <div className="relative">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold-200">
                AI Trip Planner
                <span className="rounded-full bg-gold-400/25 px-2 py-0.5 text-[10px] font-bold tracking-normal text-white">
                  New
                </span>
              </p>
              <h2 className="mt-3 font-display text-2xl font-semibold leading-snug text-white">
                Your dream journey, <span style={GOLD_TEXT}>crafted by AI</span>
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-white/85">
                Name a place. Get a personalised, day-by-day itinerary in seconds — free, no signup.
              </p>
              <button
                type="button"
                onClick={() => setPlanOpen(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-brand-900 transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
              >
                <Sparkles className="h-4 w-4 text-gold-600" aria-hidden /> Plan My Trip
              </button>
            </div>
          </motion.div>
        </motion.div>
      </div>

      <PlanModal
        open={planOpen}
        initialDestination={destination}
        onClose={() => setPlanOpen(false)}
      />
    </section>
  );
}

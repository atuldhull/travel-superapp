/**
 * /home — the signed-in homepage hub (Phase 2, D1).
 *
 * A calm, premium dashboard with the sections the spec asked for:
 * Current Trip · Upcoming Trips · Create Trip · Log Book · Explore
 * Friends' Trips · Latest News · Help/Alerts/Emergencies · Settings.
 *
 * Honest data: Current/Upcoming are derived from the real trips list
 * (owned + collaborated). Sections without a backend yet (destination
 * "Latest News" — there is no news source) show an honest "coming
 * soon" tile, never fabricated headlines. Protected like the other
 * member surfaces; signed-out `/` stays the marketing landing.
 *
 * Installed for Phase 2 — Homepage hub.
 */
'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTripControllerList } from '@app/sdk';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen,
  Compass,
  LifeBuoy,
  MapPinned,
  Navigation,
  Newspaper,
  Plus,
  Settings as SettingsIcon,
  Sparkles,
  Users,
} from 'lucide-react';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { SkeletonCard } from '../../components/ui/skeleton';
import { useAuthBootComplete, useAuthToken } from '../../lib/use-auth-token';

// The generated TripDto types startsOn/endsOn as a branded union
// (`string | object`), so read defensively into a clean local shape.
interface HubTrip {
  readonly id: string;
  readonly title: string;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function toHubTrip(row: unknown): HubTrip | null {
  if (typeof row !== 'object' || row === null) return null;
  const o = row as Record<string, unknown>;
  const id = str(o['id']);
  const title = str(o['title']);
  if (!id || !title) return null;
  return { id, title, startsOn: str(o['startsOn']), endsOn: str(o['endsOn']) };
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function HomePage() {
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  const tripsQuery = useTripControllerList(
    { limit: '50', archived: 'false' },
    { query: { enabled: token !== null } },
  );

  const { current, upcoming } = useMemo(() => {
    const env = tripsQuery.data as
      | { data?: { trips?: unknown[]; collaborated?: unknown[] } }
      | undefined;
    const raw = [...(env?.data?.trips ?? []), ...(env?.data?.collaborated ?? [])];
    const seen = new Set<string>();
    const trips: HubTrip[] = [];
    for (const r of raw) {
      const t = toHubTrip(r);
      if (t && !seen.has(t.id)) {
        seen.add(t.id);
        trips.push(t);
      }
    }
    const today = startOfToday();
    const cur = trips.filter(
      (t) =>
        t.startsOn !== null &&
        t.endsOn !== null &&
        new Date(t.startsOn).getTime() <= today &&
        new Date(t.endsOn).getTime() >= today,
    );
    const up = trips
      .filter((t): t is HubTrip & { startsOn: string } => {
        return t.startsOn !== null && new Date(t.startsOn).getTime() > today;
      })
      .sort((a, b) => new Date(a.startsOn).getTime() - new Date(b.startsOn).getTime());
    return { current: cur[0] ?? null, upcoming: up.slice(0, 3) };
  }, [tripsQuery.data]);

  if (!bootComplete || token === null) {
    return (
      <main>
        <p className="text-muted">{!bootComplete ? 'Restoring your session…' : 'Redirecting…'}</p>
      </main>
    );
  }

  return (
    <main className="space-y-8">
      <motion.header
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-10 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold-500/20 blur-[120px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <Sparkles aria-hidden className="h-3.5 w-3.5" /> Your travel companion
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Welcome back
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Pick up a journey, plan the next one, or relive the last — everything in one calm place.
        </p>
      </motion.header>

      {/* Current trip — the centrepiece */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
          Current trip
        </h2>
        {tripsQuery.isLoading ? (
          <SkeletonCard count={1} />
        ) : current ? (
          <Card depth="raised" className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gold-600">
                <Navigation aria-hidden className="h-3.5 w-3.5" /> On this trip now
              </p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-surface-foreground">
                {current.title}
              </p>
              {current.startsOn && current.endsOn ? (
                <p className="mt-0.5 text-sm text-muted">
                  {fmtDate(current.startsOn)} – {fmtDate(current.endsOn)}
                </p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Link href={`/trips/${current.id}` as never}>
                <Button variant="royal">Open trip</Button>
              </Link>
              <Link href="/navigate">
                <Button variant="secondary">Navigate</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <Card depth="flat" className="flex flex-col gap-3 p-6 text-center">
            <p className="text-sm text-muted">No trip in progress right now.</p>
            <div>
              <Link href="/trips/new">
                <Button variant="royal">
                  <Plus aria-hidden className="mr-1.5 h-4 w-4" /> Plan a trip
                </Button>
              </Link>
            </div>
          </Card>
        )}
      </section>

      {/* Upcoming */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Upcoming trips
          </h2>
          <Link
            href="/trips"
            className="text-xs font-medium text-gold-600 underline-offset-4 transition hover:underline"
          >
            All trips →
          </Link>
        </div>
        {tripsQuery.isLoading ? (
          <SkeletonCard count={1} />
        ) : upcoming.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((t) => (
              <Card as="li" key={t.id} depth="raised" interactive>
                <Link href={`/trips/${t.id}` as never} className="block p-5">
                  <p className="inline-flex items-center gap-1.5 text-xs font-medium text-gold-600">
                    <MapPinned aria-hidden className="h-3.5 w-3.5" />
                    {fmtDate(t.startsOn)}
                  </p>
                  <p className="mt-1 line-clamp-2 font-display text-lg font-semibold tracking-tight text-surface-foreground">
                    {t.title}
                  </p>
                </Link>
              </Card>
            ))}
          </ul>
        ) : (
          <Card depth="flat" className="p-5">
            <p className="text-sm text-muted">
              Nothing on the calendar yet —{' '}
              <Link href="/trips/new" className="text-gold-600 underline-offset-4 hover:underline">
                start planning
              </Link>
              .
            </p>
          </Card>
        )}
      </section>

      {/* Everything else — the hub grid */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Explore</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              {
                href: '/trips/new',
                title: 'Create a trip',
                subtitle: 'Type, places, days — an AI itinerary in one tap.',
                icon: Plus,
              },
              {
                href: '/memory-books',
                title: 'Log book',
                subtitle: 'Your memory books, diary entries & badges.',
                icon: BookOpen,
              },
              {
                href: '/feed',
                title: "Explore friends' trips",
                subtitle: 'See where people you follow are going.',
                icon: Users,
              },
              {
                href: '/navigate',
                title: 'Navigate',
                subtitle: 'Live routes, traffic & offline maps.',
                icon: Compass,
              },
              {
                href: '/help',
                title: 'Help, alerts & SOS',
                subtitle: 'Guides, emergency numbers, trusted contacts.',
                icon: LifeBuoy,
              },
              {
                href: '/account',
                title: 'Settings',
                subtitle: 'Travel style, preferences, privacy & billing.',
                icon: SettingsIcon,
              },
            ] as const
          ).map((s) => {
            const Icon = s.icon;
            return (
              <Card as="li" key={s.href} depth="raised" interactive>
                <Link href={s.href as never} className="flex items-start gap-3 p-5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/8 text-gold-600">
                    <Icon aria-hidden className="h-5 w-5" />
                  </span>
                  <span>
                    <CardTitle className="text-lg">{s.title}</CardTitle>
                    <CardSubtitle>{s.subtitle}</CardSubtitle>
                  </span>
                </Link>
              </Card>
            );
          })}
        </ul>
      </section>

      {/* Latest news — honest: no destination-news source yet. */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
          Latest news
        </h2>
        <Card depth="flat" className="flex items-start gap-3 p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/8 text-gold-600">
            <Newspaper aria-hidden className="h-5 w-5" />
          </span>
          <div>
            <CardHeader>
              <CardTitle className="text-lg">Destination news</CardTitle>
              <CardSubtitle>
                Live news & advisories for your destinations are coming in a later phase — we
                won&apos;t show placeholder headlines. For now,{' '}
                <Link href="/help" className="text-gold-600 underline-offset-4 hover:underline">
                  Help &amp; alerts
                </Link>{' '}
                covers emergencies and safety.
              </CardSubtitle>
            </CardHeader>
          </div>
        </Card>
      </section>
    </main>
  );
}

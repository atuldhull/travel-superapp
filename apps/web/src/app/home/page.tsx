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

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { tripControllerOverview, useTripControllerList } from '@app/sdk';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Compass,
  LifeBuoy,
  MapPinned,
  Navigation,
  Plus,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  Users,
} from 'lucide-react';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { SkeletonCard } from '../../components/ui/skeleton';
import { useAuthBootComplete, useAuthToken } from '../../lib/use-auth-token';
import {
  getGamification,
  getSocialFeed,
  listDiaryEntries,
  type DiaryEntryDto,
  type GamificationView,
} from '../../lib/two-oh-api';
import { openAssistantWith } from '../../components/assistant/global-assistant';

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

// D4 — defensive weather narrowing. The overview endpoint types
// `weather` as a `success | failure` union but the inner forecast is
// `Record<string, unknown>` (orval can't reify it), so we read the
// daily array by hand. Three days is enough for a hub glance.
interface HubWeatherDay {
  readonly date: string;
  readonly maxC: number;
  readonly minC: number;
  readonly code: number;
  readonly precipPct: number | null;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

interface ParsedWeather {
  readonly days: readonly HubWeatherDay[];
  readonly center: { lat: number; lng: number } | null;
}

function parseWeather(overview: unknown): ParsedWeather | null {
  if (!isObj(overview)) return null;
  const env = overview['data'];
  const root = isObj(env) ? env : overview;
  const w = isObj(root) ? root['weather'] : null;
  if (!isObj(w) || w['ok'] !== true) return null;
  const data = w['data'];
  const forecast = isObj(data) ? data['forecast'] : null;
  const days = isObj(forecast) ? forecast['days'] : null;
  if (!Array.isArray(days)) return null;
  const out: HubWeatherDay[] = [];
  for (const d of days.slice(0, 3)) {
    if (!isObj(d)) continue;
    const date = typeof d['date'] === 'string' ? d['date'] : null;
    const maxC = num(d['maxTempC']);
    const minC = num(d['minTempC']);
    const code = num(d['weatherCode']);
    if (date === null || maxC === null || minC === null || code === null) continue;
    out.push({ date, maxC, minC, code, precipPct: num(d['precipitationProbabilityPercent']) });
  }
  if (out.length === 0) return null;
  // The weather provider uses the trip center, so its forecast.lat/lng
  // *is* the trip center — honest reuse, no extra fetch.
  const lat = isObj(forecast) ? num(forecast['lat']) : null;
  const lng = isObj(forecast) ? num(forecast['lng']) : null;
  return { days: out, center: lat !== null && lng !== null ? { lat, lng } : null };
}

// WMO → lucide icon + short label. Coarse buckets match Open-Meteo's
// own grouping (see weather-response.dto.ts comment).
function wmoVisual(code: number): { Icon: typeof Sun; label: string } {
  if (code === 0) return { Icon: Sun, label: 'Clear' };
  if (code <= 3) return { Icon: CloudSun, label: 'Partly cloudy' };
  if (code === 45 || code === 48) return { Icon: CloudFog, label: 'Fog' };
  if (code >= 51 && code <= 57) return { Icon: CloudDrizzle, label: 'Drizzle' };
  if (code >= 61 && code <= 67) return { Icon: CloudRain, label: 'Rain' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return { Icon: CloudSnow, label: 'Snow' };
  if (code >= 80 && code <= 82) return { Icon: CloudRain, label: 'Showers' };
  if (code >= 95) return { Icon: CloudLightning, label: 'Thunder' };
  return { Icon: Cloud, label: 'Cloudy' };
}

function fmtDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short' });
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

  // D3 — live snapshot for the journal + social cards. Plain async
  // fns (not hooks); all-settled + never-broken: a failure just
  // leaves that card in its calm fallback.
  const [gami, setGami] = useState<GamificationView | null>(null);
  const [lastEntry, setLastEntry] = useState<DiaryEntryDto | null>(null);
  const [feed, setFeed] = useState<{ count: number; latest: string | null } | null>(null);

  useEffect(() => {
    if (token === null) return;
    let alive = true;
    void (async () => {
      const [g, d, f] = await Promise.allSettled([
        getGamification(),
        listDiaryEntries({ limit: 1 }),
        getSocialFeed({ limit: 5 }),
      ]);
      if (!alive) return;
      if (g.status === 'fulfilled') setGami(g.value);
      if (d.status === 'fulfilled') setLastEntry(d.value.entries[0] ?? null);
      if (f.status === 'fulfilled') {
        setFeed({
          count: f.value.items.length,
          latest: f.value.items[0]?.publishedAt ?? null,
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  // D4 — real weather (Open-Meteo via /trips/:id/overview) for the
  // active or next-up trip. Honest: never fabricate; on failure the
  // section renders a calm "weather unavailable" line.
  const weatherTrip = useMemo<HubTrip | null>(() => {
    return current ?? upcoming[0] ?? null;
  }, [current, upcoming]);
  type WeatherState =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'ok'; days: readonly HubWeatherDay[]; center: { lat: number; lng: number } | null }
    | { kind: 'unavailable' };
  const [weather, setWeather] = useState<WeatherState>({ kind: 'idle' });

  useEffect(() => {
    if (token === null || !weatherTrip) {
      setWeather({ kind: 'idle' });
      return;
    }
    let alive = true;
    setWeather({ kind: 'loading' });
    void (async () => {
      try {
        const res = await tripControllerOverview(weatherTrip.id);
        if (!alive) return;
        const parsed = parseWeather(res);
        setWeather(
          parsed
            ? { kind: 'ok', days: parsed.days, center: parsed.center }
            : { kind: 'unavailable' },
        );
      } catch {
        if (!alive) return;
        setWeather({ kind: 'unavailable' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [token, weatherTrip?.id]);

  // D5 — when we have the current trip's center (harvested from the
  // weather fetch above), let users open the global assistant pre-
  // seeded with that context. If center isn't known yet, the button
  // simply doesn't render — never broken.
  const currentCenter = useMemo<{ lat: number; lng: number } | null>(() => {
    if (!current || weather.kind !== 'ok') return null;
    if (weatherTrip?.id !== current.id) return null;
    return weather.center;
  }, [current, weather, weatherTrip]);

  // Day X of N for the active trip (honest: only when dated).
  const dayProgress = useMemo(() => {
    if (!current?.startsOn || !current?.endsOn) return null;
    const s = new Date(current.startsOn).getTime();
    const e = new Date(current.endsOn).getTime();
    const now = startOfToday();
    const totalDays = Math.max(1, Math.round((e - s) / 86_400_000) + 1);
    const dayIdx = Math.min(totalDays, Math.max(1, Math.round((now - s) / 86_400_000) + 1));
    return { dayIdx, totalDays };
  }, [current]);

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
              {dayProgress ? (
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 bg-gold-500/10 px-3 py-1 text-xs font-medium text-gold-700 dark:text-gold-200">
                  Day {dayProgress.dayIdx} of {dayProgress.totalDays}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/trips/${current.id}` as never}>
                <Button variant="royal">Open trip</Button>
              </Link>
              <Link href="/navigate">
                <Button variant="secondary">Navigate</Button>
              </Link>
              {currentCenter ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    openAssistantWith({ title: current.title, center: currentCenter });
                  }}
                >
                  <Sparkles aria-hidden className="mr-1.5 h-4 w-4" /> Plan with AI
                </Button>
              ) : null}
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

      {/* Log book + friends — live snapshots, not just links */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Card as="div" depth="raised" interactive>
          <Link href="/diary" className="flex items-start gap-3 p-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/8 text-gold-600">
              <BookOpen aria-hidden className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-lg">Your log book</CardTitle>
              {gami ? (
                <CardSubtitle>
                  🔥 {gami.currentStreak}-day streak · {gami.totalPoints} pts · {gami.entryCount}{' '}
                  {gami.entryCount === 1 ? 'entry' : 'entries'}
                  {lastEntry ? (
                    <span className="mt-1 block truncate text-muted">
                      Last: “{lastEntry.title}” · {fmtDate(lastEntry.entryDate)}
                    </span>
                  ) : null}
                </CardSubtitle>
              ) : (
                <CardSubtitle>Memory books, diary entries &amp; badges.</CardSubtitle>
              )}
            </div>
          </Link>
        </Card>
        <Card as="div" depth="raised" interactive>
          <Link href="/feed" className="flex items-start gap-3 p-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/8 text-gold-600">
              <Users aria-hidden className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-lg">Friends&apos; trips</CardTitle>
              {feed && feed.count > 0 ? (
                <CardSubtitle>
                  {feed.count} recent published {feed.count === 1 ? 'trip' : 'trips'} from people
                  you follow
                  {feed.latest ? ` · latest ${fmtDate(feed.latest)}` : ''} — open the feed.
                </CardSubtitle>
              ) : (
                <CardSubtitle>See where people you follow are going.</CardSubtitle>
              )}
            </div>
          </Link>
        </Card>
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

      {/* Weather — real Open-Meteo forecast for the active or next-up
          trip. Honest: nothing to forecast if you have no trips yet,
          and we say so plainly when the upstream is down. */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
          {current ? 'Weather where you are' : 'Weather where you’re going'}
        </h2>
        {weatherTrip === null ? (
          <Card depth="flat" className="p-5">
            <CardSubtitle>
              We&apos;ll show live weather here when you have an active or upcoming trip.
            </CardSubtitle>
          </Card>
        ) : weather.kind === 'loading' || weather.kind === 'idle' ? (
          <SkeletonCard count={1} />
        ) : weather.kind === 'ok' ? (
          <Card depth="raised" className="p-5">
            <CardHeader>
              <CardTitle className="text-lg">{weatherTrip.title}</CardTitle>
              <CardSubtitle>
                Live 3-day forecast · Open-Meteo ·{' '}
                <Link
                  href={`/trips/${weatherTrip.id}` as never}
                  className="text-gold-600 underline-offset-4 hover:underline"
                >
                  full overview →
                </Link>
              </CardSubtitle>
            </CardHeader>
            <ul className="mt-4 grid gap-2 sm:grid-cols-3">
              {weather.days.map((d) => {
                const { Icon, label } = wmoVisual(d.code);
                return (
                  <li
                    key={d.date}
                    className="flex items-center gap-3 rounded-2xl border border-gold-500/15 bg-surface/40 p-3"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/8 text-gold-600">
                      <Icon aria-hidden className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">
                        {fmtDay(d.date)}
                      </p>
                      <p className="truncate text-sm text-surface-foreground">
                        {label} · {Math.round(d.maxC)}° / {Math.round(d.minC)}°
                        {d.precipPct !== null && d.precipPct > 0 ? (
                          <span className="ml-1 text-muted">· {d.precipPct}%</span>
                        ) : null}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : (
          <Card depth="flat" className="p-5">
            <CardSubtitle>
              Live weather is briefly unavailable for {weatherTrip.title}. It usually comes back
              within a minute — your{' '}
              <Link
                href={`/trips/${weatherTrip.id}` as never}
                className="text-gold-600 underline-offset-4 hover:underline"
              >
                trip overview
              </Link>{' '}
              will refresh when it does.
            </CardSubtitle>
          </Card>
        )}
      </section>
    </main>
  );
}

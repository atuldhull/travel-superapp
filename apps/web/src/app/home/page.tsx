/**
 * /home — the signed-in homepage hub (Phase 2 D1 + ongoing).
 *
 * A calm, premium dashboard the user lands on after sign-in. Every
 * section is honest about its data source — nothing on this page
 * is fabricated. Sections (top → bottom):
 *
 *   • **Welcome hero** — gradient header, "Plan with AI" entry.
 *   • **Current Trip** card (D1, F2, F21, F22, G2, G3): live trip
 *     row with Day-X-of-N (F3 dayProgress), local destination time
 *     (F22, from the weather forecast's timezone), "What's next
 *     today" + ETA + ✓ progress (F21/G2, parsed from the same
 *     overview fetch), and a trip-scoped agent-replan callout (G3).
 *     The "Plan with AI" button (D5/F2/F9) opens the global assistant
 *     pre-seeded with this trip's title + center (lifted to
 *     `useTripCenter`).
 *   • **Upcoming trips** (D1, F20): list with "in N days" countdown.
 *   • **Log Book + Friends** (D3): Promise.allSettled snapshot of
 *     gamification, latest diary entry, and the social feed count.
 *   • **Weather** (D4, F3): 3-day Open-Meteo forecast for the active
 *     or next-up trip via `tripControllerOverview` + visibility +
 *     10-min refresh. Calm "briefly unavailable" fallback.
 *   • **Local safety basics** (F7): emergency numbers (public) +
 *     curated country-primer scam chips (auth-gated, may 404 → row
 *     hides). Reverse-geocoded ISO via Photon → Nominatim fallback.
 *   • **Unread inbox preview** (F23): top-3 unread, humanised
 *     templates, relative time. Section hides when empty.
 *   • **Explore grid**: Create / Navigate / Help / Settings cards.
 *
 * Cross-cutting:
 *   • Defensive TripDto coercion via `lib/trip-dto` (F4).
 *   • Subtle CSS-only ambient backdrop `<HubAmbient />` (D6).
 *   • AuraNudge is skipped on /home (F18) — Account hub + the F8
 *     CTA on /trips/new cover the "set your style" call-out.
 *   • Protected route; signed-out `/` stays the marketing landing.
 *
 * Installed for Phase 2 — Homepage hub. Extended through F1-F28 +
 * G1-G3.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  countryPrimerControllerGet,
  emergencyNumbersControllerGet,
  tripControllerOverview,
  useNotificationsControllerListMine,
  useTripControllerList,
} from '@app/sdk';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Bell,
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
  Phone,
  Plus,
  Settings as SettingsIcon,
  ShieldAlert,
  Sparkles,
  Sun,
  Users,
} from 'lucide-react';
import { reverseGeocodeCountryCode } from '../../lib/geocode';
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
import { HubAmbient, pickAmbientMood, type AmbientMood } from '../../components/home/hub-ambient';
import { CompanionNudges, type CompanionContext } from '../../components/home/companion-nudges';
import { InstallAppButton } from '../../components/pwa/install-app-button';
import { toHubTripView, type HubTripView } from '../../lib/trip-dto';
import { useTripCenter } from '../../lib/use-trip-center';

// Local alias keeps the per-file callsites short while reading from
// the shared lib (Phase 2 polish F4 — same coercion now used by /trips).
type HubTrip = HubTripView;
const toHubTrip = toHubTripView;

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// F20 — full days until a future ISO date. Returns null on bad input,
// 0 for today, positive integer for future, negative for past. The
// Upcoming card only ever feeds future startsOn, but the helper stays
// general so any future caller can rely on its sign.
function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const target = new Date(iso);
  if (!Number.isFinite(target.getTime())) return null;
  const t0 = new Date();
  t0.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - t0.getTime()) / 86_400_000);
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

interface ParsedHubWeather {
  readonly days: readonly HubWeatherDay[];
  // F22 — Open-Meteo returns the resolved IANA timezone for the
  // trip's coords (e.g. "Asia/Kolkata"). Used on the Current Trip
  // card to show local time.
  readonly timezone: string | null;
}

// F21 — "What's next today" glance pulled from the SAME overview
// fetch (no extra network roundtrip). Honest: only when the trip
// has an itinerary section that succeeded AND today's date matches
// one of the day rows.
interface TodayPlan {
  readonly summary: string | null;
  readonly itemCount: number;
  // First NOT-completed item's title + optional startTime (ISO).
  // G2 — used to render an ETA chip on /home.
  readonly nextItemTitle: string | null;
  readonly nextItemStartTime: string | null;
  readonly completedCount: number;
}

function parseTodayPlan(overview: unknown, timezone: string | null): TodayPlan | null {
  if (!isObj(overview)) return null;
  const env = overview['data'];
  const root = isObj(env) ? env : overview;
  const it = isObj(root) ? root['itinerary'] : null;
  if (!isObj(it) || it['ok'] !== true) return null;
  const data = it['data'];
  const days = isObj(data) ? data['days'] : null;
  if (!Array.isArray(days)) return null;
  // Today in the destination's local date (falls back to user-local
  // if we don't know the trip TZ — close enough for the hub glance).
  const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()); // → 'YYYY-MM-DD'
  for (const d of days) {
    if (!isObj(d)) continue;
    const date = typeof d['date'] === 'string' ? d['date'].slice(0, 10) : null;
    if (date !== today) continue;
    const summary = typeof d['summary'] === 'string' ? d['summary'].trim() : null;
    const items = Array.isArray(d['items']) ? d['items'] : [];
    // G1/G2 — find the first uncompleted item (so users see "next"
    // not "first ever"). Counts completed for the progress chip.
    let nextItemTitle: string | null = null;
    let nextItemStartTime: string | null = null;
    let completedCount = 0;
    for (const item of items) {
      if (!isObj(item)) continue;
      if (item['completedAt']) {
        completedCount += 1;
        continue;
      }
      if (nextItemTitle === null) {
        nextItemTitle = typeof item['title'] === 'string' ? item['title'] : null;
        nextItemStartTime = typeof item['startTime'] === 'string' ? item['startTime'] : null;
      }
    }
    return {
      summary: summary && summary.length > 0 ? summary : null,
      itemCount: items.length,
      nextItemTitle,
      nextItemStartTime,
      completedCount,
    };
  }
  return null;
}

// G2 — short human countdown to a future ISO instant. Returns null
// if the instant is past (or invalid). "5m", "1h 23m", "in 3h".
function timeUntil(iso: string | null): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = t - Date.now();
  if (diff <= 0) return null;
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `in ${h}h` : `in ${h}h ${m}m`;
}

function parseWeather(overview: unknown): ParsedHubWeather | null {
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
  const tz =
    isObj(forecast) && typeof forecast['timezone'] === 'string' ? forecast['timezone'] : null;
  return { days: out, timezone: tz };
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

// F23 — template id → human label fallback (when the payload didn't
// carry a `subject`). Covers the templates we ship today; unknown
// ones drop the prefix + show the remainder ("foo.bar.baz" → "Foo
// bar baz").
function humanTemplate(templateId: string): string {
  const known: Record<string, string> = {
    'trip.invited': 'You were invited to a trip',
    'trip.share.created': 'New share link for your trip',
    'sos.acknowledged': 'Your SOS was acknowledged',
    'sos.resolved': 'Your SOS was resolved',
    trip_agent_replan_proposed: 'Agent suggested a replan',
    'magic_link.sent': 'Magic link sent',
  };
  const hit = known[templateId];
  if (hit) return hit;
  return templateId.replace(/[._]/g, ' ').replace(/^(.)/, (s) => s.toUpperCase());
}

// F23 — compact relative time ("2m", "1h", "3d") for the inbox
// preview. Falls back to a short date when older than 7 days.
function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diffMs = Date.now() - t;
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
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

  const { current, upcoming, past } = useMemo(() => {
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
    // H6 — past trips for the memory timeline. endsOn < today
    // (started + finished). Sorted most-recently-ended first; capped
    // at 6 so the strip doesn't overflow.
    const pastTrips = trips
      .filter((t): t is HubTrip & { startsOn: string; endsOn: string } => {
        return t.startsOn !== null && t.endsOn !== null && new Date(t.endsOn).getTime() < today;
      })
      .sort((a, b) => new Date(b.endsOn).getTime() - new Date(a.endsOn).getTime())
      .slice(0, 6);
    return { current: cur[0] ?? null, upcoming: up.slice(0, 3), past: pastTrips };
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
    | { kind: 'ok'; days: readonly HubWeatherDay[]; timezone: string | null }
    | { kind: 'unavailable' };
  const [weather, setWeather] = useState<WeatherState>({ kind: 'idle' });
  // F21 — "What's next today" parsed from the same overview fetch.
  const [todayPlan, setTodayPlan] = useState<TodayPlan | null>(null);

  // F23 — inbox preview. Top 3 unread + a "see more" link to /inbox.
  // Honest: failed fetch + no unread = section hides entirely.
  // orval marks the params required even though the controller treats
  // channel + includeArchived as optional — same `as never` cast that
  // /inbox uses (precedent: apps/web/src/app/inbox/page.tsx:66).
  const inboxQuery = useNotificationsControllerListMine({ limit: '10' } as never, {
    query: { enabled: token !== null, retry: false },
  });
  const unreadPreview = useMemo(() => {
    const env = inboxQuery.data as { data?: { notifications?: unknown[] } } | undefined;
    const raw = env?.data?.notifications ?? [];
    const items: { id: string; templateId: string; subject: string; createdAt: string }[] = [];
    for (const row of raw) {
      if (!isObj(row)) continue;
      if (row['archivedAt'] !== null && row['archivedAt'] !== undefined) continue;
      if (row['read'] === true) continue;
      const id = typeof row['id'] === 'string' ? row['id'] : null;
      const templateId = typeof row['templateId'] === 'string' ? row['templateId'] : 'notification';
      const createdAt = typeof row['createdAt'] === 'string' ? row['createdAt'] : null;
      if (!id || !createdAt) continue;
      const payload = isObj(row['payload']) ? row['payload'] : {};
      const subject =
        typeof payload['subject'] === 'string' && payload['subject'].length > 0
          ? payload['subject']
          : humanTemplate(templateId);
      items.push({ id, templateId, subject, createdAt });
      if (items.length >= 3) break;
    }
    return items;
  }, [inboxQuery.data]);

  // G3 — surface agent replan proposals for the CURRENT trip as a
  // prominent callout on the Current Trip card. Reads the same
  // inbox query the F23 unread-preview consumes (no extra fetch).
  // Honest: we filter by templateId AND by `payload.context.url`
  // containing the trip id, so a proposal for trip-A doesn't show
  // up on trip-B's card.
  const tripAlert = useMemo<{
    id: string;
    subject: string;
    url: string | null;
    templateId: string;
  } | null>(() => {
    if (!current) return null;
    const env = inboxQuery.data as { data?: { notifications?: unknown[] } } | undefined;
    const raw = env?.data?.notifications ?? [];
    for (const row of raw) {
      if (!isObj(row)) continue;
      if (row['archivedAt'] !== null && row['archivedAt'] !== undefined) continue;
      if (row['read'] === true) continue;
      const templateId = typeof row['templateId'] === 'string' ? row['templateId'] : '';
      if (!templateId.includes('replan') && !templateId.includes('trip_agent')) continue;
      const id = typeof row['id'] === 'string' ? row['id'] : null;
      if (!id) continue;
      const payload = isObj(row['payload']) ? row['payload'] : {};
      const ctx = isObj(payload['context']) ? payload['context'] : {};
      const url = typeof ctx['url'] === 'string' ? ctx['url'] : null;
      // Honest scope: trust the alert only when its url points at
      // this trip. Without a url match we'd risk attaching a stale
      // alert from a different trip to the current trip's card.
      if (url && !url.includes(current.id)) continue;
      const subject =
        typeof payload['subject'] === 'string' && payload['subject'].length > 0
          ? payload['subject']
          : humanTemplate(templateId);
      return { id, subject, url, templateId };
    }
    return null;
  }, [current, inboxQuery.data]);

  // F3 — refresh strategy. Initial fetch + a quiet 10-minute interval
  // + a refresh on tab visibility-change. Open-Meteo doesn't churn
  // by the second; this just keeps a long-open hub from sitting on
  // stale data. The server-side overview cache is 60s, so multiple
  // close-spaced refreshes are cheap.
  useEffect(() => {
    if (token === null || !weatherTrip) {
      setWeather({ kind: 'idle' });
      return;
    }
    let alive = true;
    const fetchOnce = async (firstTime: boolean) => {
      if (firstTime) setWeather({ kind: 'loading' });
      try {
        const res = await tripControllerOverview(weatherTrip.id);
        if (!alive) return;
        const parsed = parseWeather(res);
        // Don't downgrade a previously-OK card to "unavailable" on a
        // background refresh hiccup; only the initial fetch can flip
        // to the unavailable copy. Honest: stale-but-shown beats
        // bouncing "unavailable" on a 1-second blip.
        setWeather((prev) => {
          if (parsed) return { kind: 'ok', days: parsed.days, timezone: parsed.timezone };
          if (!firstTime && prev.kind === 'ok') return prev;
          return { kind: 'unavailable' };
        });
        // F21 — harvest today's plan from the SAME response. No new
        // network call. Null when no match for today's date.
        setTodayPlan(parseTodayPlan(res, parsed?.timezone ?? null));
      } catch {
        if (!alive) return;
        setWeather((prev) => (firstTime || prev.kind !== 'ok' ? { kind: 'unavailable' } : prev));
      }
    };
    void fetchOnce(true);
    const interval = window.setInterval(
      () => {
        if (document.visibilityState === 'visible') void fetchOnce(false);
      },
      10 * 60 * 1000,
    );
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchOnce(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on weatherTrip?.id; the full weatherTrip object is intentionally excluded so the poll doesn't restart every render
  }, [token, weatherTrip?.id]);

  // D5 — independent trip-center fetch (Phase 2 polish F2, lifted
  // to the shared `useTripCenter` hook in F9 so /trips/[id] uses
  // the same path).
  const currentCenter = useTripCenter(token !== null && current ? current.id : null);

  // H1 — derive an ambient mood for the hub backdrop from the
  // destination's first forecast day + local hour (timezone-aware
  // when known, otherwise user-local). Honest: when weather isn't
  // available we fall back to 'calm' (the original D6 palette).
  const ambientMood = useMemo<AmbientMood>(() => {
    if (weather.kind !== 'ok' || weather.days.length === 0) {
      // No weather signal yet — still try a time-of-day mood.
      return pickAmbientMood(null, new Date().getHours());
    }
    const code = weather.days[0]!.code;
    const tz = weather.timezone;
    let hour: number;
    if (tz) {
      // 'HH' in en-GB gives a 24-hour clock for the trip's TZ.
      const fmt = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        hour12: false,
        timeZone: tz,
      });
      hour = Number.parseInt(fmt.format(new Date()), 10);
      if (!Number.isFinite(hour)) hour = new Date().getHours();
    } else {
      hour = new Date().getHours();
    }
    return pickAmbientMood(code, hour);
  }, [weather]);

  // F7 — destination safety basics for the active or next-up trip.
  // Two cheap reads behind the trip center:
  //   - reverseGeocodeCountryCode (Photon → Nominatim, $0/no-key)
  //   - GET /safety/emergency-numbers/:cc  (public, every ISO country)
  //   - GET /safety/country-primer/:cc     (auth, top scams + visa,
  //     seeded for a curated subset → may 404)
  // Honest: section only renders when reverse-geo succeeds AND at
  // least the emergency numbers are available. Scams + visa are a
  // bonus when the country is in the curated primer set.
  interface SafetyEmergency {
    readonly countryCode: string;
    readonly countryName: string;
    readonly universal: string | null;
    readonly police: string | null;
    readonly ambulance: string | null;
    readonly fire: string | null;
  }
  interface SafetyPrimer {
    readonly topScamCategories: readonly string[];
    readonly visaInfo: string;
  }
  type SafetyState =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'ok'; emergency: SafetyEmergency; primer: SafetyPrimer | null }
    | { kind: 'unavailable' };
  const [safety, setSafety] = useState<SafetyState>({ kind: 'idle' });
  const safetyTrip = weatherTrip; // same target: current ?? upcoming[0]

  useEffect(() => {
    if (token === null || !safetyTrip || !currentCenter) {
      setSafety({ kind: 'idle' });
      return;
    }
    let alive = true;
    setSafety({ kind: 'loading' });
    void (async () => {
      try {
        const cc = await reverseGeocodeCountryCode(currentCenter.lat, currentCenter.lng);
        if (!alive) return;
        if (!cc) {
          setSafety({ kind: 'unavailable' });
          return;
        }
        const [emergencyR, primerR] = await Promise.allSettled([
          emergencyNumbersControllerGet(cc) as unknown as Promise<{ data: SafetyEmergency }>,
          countryPrimerControllerGet(cc) as unknown as Promise<{ data: SafetyPrimer }>,
        ]);
        if (!alive) return;
        if (emergencyR.status !== 'fulfilled' || !emergencyR.value.data) {
          setSafety({ kind: 'unavailable' });
          return;
        }
        const primer =
          primerR.status === 'fulfilled' && primerR.value.data ? primerR.value.data : null;
        setSafety({ kind: 'ok', emergency: emergencyR.value.data, primer });
      } catch {
        if (alive) setSafety({ kind: 'unavailable' });
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on safetyTrip?.id; the full safetyTrip object is intentionally excluded so the fetch doesn't restart every render
  }, [token, safetyTrip?.id, currentCenter]);

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

  // H2 — Companion nudges context. All optional; the component
  // only renders nudges whose data is genuinely available. Depends
  // on dayProgress + todayPlan declared above; this block stays
  // below them.
  const companionCtx = useMemo<CompanionContext>(() => {
    const targetTrip = current ?? upcoming[0] ?? null;
    const daysUntilStart = !current && upcoming[0] ? daysUntil(upcoming[0].startsOn) : null;
    const firstForecastDay =
      weather.kind === 'ok' && weather.days.length > 0
        ? {
            maxC: weather.days[0]!.maxC,
            minC: weather.days[0]!.minC,
            precipPct: weather.days[0]!.precipPct,
          }
        : null;
    return {
      daysUntilStart,
      dayProgressIdx: dayProgress?.dayIdx ?? null,
      dayProgressTotal: dayProgress?.totalDays ?? null,
      completedCount: todayPlan?.completedCount ?? null,
      itemCount: todayPlan?.itemCount ?? null,
      firstForecastDay,
      tripTitle: targetTrip?.title ?? null,
      tripId: targetTrip?.id ?? null,
    };
  }, [current, upcoming, weather, dayProgress, todayPlan]);

  if (!bootComplete || token === null) {
    return (
      <main>
        <p className="text-muted">{!bootComplete ? 'Restoring your session…' : 'Redirecting…'}</p>
      </main>
    );
  }

  return (
    <main className="space-y-8">
      <HubAmbient mood={ambientMood} />
      <CompanionNudges ctx={companionCtx} />
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

      {/* I6 — install affordance. Renders nothing until Chromium
          fires `beforeinstallprompt`; self-hides once installed. */}
      <InstallAppButton />

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
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {dayProgress ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 bg-gold-500/10 px-3 py-1 text-xs font-medium text-gold-700 dark:text-gold-200">
                    Day {dayProgress.dayIdx} of {dayProgress.totalDays}
                  </span>
                ) : null}
                {/* F21 + G2 — today's plan glance + ETA chip. Honest:
                    only when the overview's itinerary section succeeded
                    AND today's date matches one of the day rows. G2 adds
                    the time-to-next-item when the next uncompleted item
                    has a startTime, plus a progress chip. */}
                {todayPlan && weatherTrip?.id === current.id ? (
                  <>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/8 px-3 py-1 text-xs text-surface-foreground"
                      title={todayPlan.nextItemTitle ?? todayPlan.summary ?? undefined}
                    >
                      📍{' '}
                      {todayPlan.nextItemTitle ? (
                        <>
                          Next: {todayPlan.nextItemTitle}
                          {(() => {
                            const eta = timeUntil(todayPlan.nextItemStartTime);
                            return eta ? <span className="ml-1 text-muted">· {eta}</span> : null;
                          })()}
                        </>
                      ) : todayPlan.summary ? (
                        todayPlan.summary
                      ) : (
                        `${todayPlan.itemCount} planned today`
                      )}
                    </span>
                    {todayPlan.itemCount > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border border-gold-600/20 bg-surface/60 px-3 py-1 text-xs text-muted"
                        title="Items checked off today"
                      >
                        ✓ {todayPlan.completedCount}/{todayPlan.itemCount}
                      </span>
                    ) : null}
                  </>
                ) : null}
                {/* F22 — local destination time, honest: only when we
                    actually know the timezone (from the weather
                    forecast for the same trip). Skips otherwise. */}
                {weather.kind === 'ok' && weather.timezone && weatherTrip?.id === current.id ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border border-gold-600/20 bg-surface/60 px-3 py-1 text-xs text-muted"
                    title={`Local time in ${weather.timezone}`}
                  >
                    {new Date().toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: weather.timezone,
                    })}{' '}
                    local
                  </span>
                ) : null}
              </div>
              {/* G3 — agent replan callout. Renders ONLY when the
                  current trip has an unread agent replan proposal
                  (matched by url). Links to /agent/runs/[id] if the
                  payload carried a deep-link, /inbox otherwise. */}
              {tripAlert ? (
                <Link
                  href={(tripAlert.url ?? '/inbox') as never}
                  className="mt-2 inline-flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 transition hover:bg-amber-500/15 dark:text-amber-300"
                >
                  <span aria-hidden>⚠️</span>
                  <span className="flex-1">
                    <span className="font-medium">{tripAlert.subject}</span>{' '}
                    <span className="opacity-80">— tap to review</span>
                  </span>
                </Link>
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
                    openAssistantWith({
                      title: current.title,
                      center: currentCenter,
                      tripId: current.id,
                    });
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
            {upcoming.map((t) => {
              // F20 — countdown chip. Honest: only when startsOn parses.
              const days = daysUntil(t.startsOn);
              const countdown =
                days === null
                  ? null
                  : days === 0
                    ? 'Today'
                    : days === 1
                      ? 'Tomorrow'
                      : days <= 7
                        ? `in ${days} days`
                        : days <= 14
                          ? 'in 1 week'
                          : days <= 30
                            ? `in ${Math.round(days / 7)} weeks`
                            : `in ${Math.round(days / 30)} months`;
              return (
                <Card as="li" key={t.id} depth="raised" interactive>
                  <Link href={`/trips/${t.id}` as never} className="block p-5">
                    <p className="inline-flex items-center gap-1.5 text-xs font-medium text-gold-600">
                      <MapPinned aria-hidden className="h-3.5 w-3.5" />
                      {fmtDate(t.startsOn)}
                      {countdown ? <span className="text-muted">· {countdown}</span> : null}
                    </p>
                    <p className="mt-1 line-clamp-2 font-display text-lg font-semibold tracking-tight text-surface-foreground">
                      {t.title}
                    </p>
                  </Link>
                </Card>
              );
            })}
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

      {/* H6 — Memory timeline. Horizontal strip of past trips,
          most-recently-ended first, each linking into its cinematic
          recap (/trips/[id]/recap). Section only renders when there
          IS at least one past trip — honest, never empty-padded. */}
      {past.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Your travel memories
            </h2>
            <Link
              href="/trips"
              className="text-xs font-medium text-gold-600 underline-offset-4 transition hover:underline"
            >
              All trips →
            </Link>
          </div>
          <ul
            className="flex gap-3 overflow-x-auto pb-2"
            // Mild snap behaviour so phones flick neatly between cards.
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {past.map((t) => (
              <li
                key={t.id}
                className="shrink-0 basis-64 sm:basis-72"
                style={{ scrollSnapAlign: 'start' }}
              >
                <Card depth="raised" interactive className="h-full">
                  <Link href={`/trips/${t.id}/recap` as never} className="block p-5">
                    <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gold-600">
                      <Sparkles aria-hidden className="h-3.5 w-3.5" /> Recap
                    </p>
                    <p className="mt-1 line-clamp-2 font-display text-lg font-semibold tracking-tight text-surface-foreground">
                      {t.title}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {fmtDate(t.startsOn)} – {fmtDate(t.endsOn)}
                    </p>
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* F23 — unread inbox preview. Only renders when there's
          something unread. */}
      {unreadPreview.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Unread inbox
            </h2>
            <Link
              href="/inbox"
              className="text-xs font-medium text-gold-600 underline-offset-4 transition hover:underline"
            >
              See all →
            </Link>
          </div>
          <Card depth="raised" className="p-2">
            <ul>
              {unreadPreview.map((n) => (
                <li key={n.id}>
                  <Link
                    href={'/inbox'}
                    className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-gold-500/5"
                  >
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-gold-500/25 bg-gold-500/8 text-gold-600">
                      <Bell aria-hidden className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-surface-foreground">{n.subject}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted">{relativeTime(n.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

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

      {/* F7 — destination safety basics. Only renders when we found
          the trip's country (reverse-geocoded) AND at least the
          emergency numbers came back. Top scams + visa show only
          when the country has a curated primer; otherwise we
          honestly say "We don't have a primer for {country} yet." */}
      {safetyTrip !== null && safety.kind === 'ok' ? (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
            Local safety basics
          </h2>
          <Card depth="raised" className="p-5">
            <CardHeader>
              <CardTitle className="text-lg">
                <span className="inline-flex items-center gap-2">
                  <ShieldAlert aria-hidden className="h-5 w-5 text-gold-600" />
                  {safety.emergency.countryName}
                </span>
              </CardTitle>
              <CardSubtitle>
                Emergency numbers are public reference data. Scams + visa info come from our curated{' '}
                <Link href="/help" className="text-gold-600 underline-offset-4 hover:underline">
                  safety primer
                </Link>{' '}
                for the country.
              </CardSubtitle>
            </CardHeader>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  { label: 'Universal', value: safety.emergency.universal },
                  { label: 'Police', value: safety.emergency.police },
                  { label: 'Ambulance', value: safety.emergency.ambulance },
                  { label: 'Fire', value: safety.emergency.fire },
                ] satisfies readonly { label: string; value: string | null }[]
              )
                .filter((row): row is { label: string; value: string } => row.value !== null)
                .map((row) => (
                  <li
                    key={row.label}
                    className="flex items-center gap-3 rounded-2xl border border-gold-500/15 bg-surface/40 p-3"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/8 text-gold-600">
                      <Phone aria-hidden className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">
                        {row.label}
                      </p>
                      <p className="text-sm font-semibold tracking-tight text-surface-foreground">
                        {row.value}
                      </p>
                    </div>
                  </li>
                ))}
            </ul>
            {safety.primer && safety.primer.topScamCategories.length > 0 ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Watch out for
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {safety.primer.topScamCategories.slice(0, 6).map((scam) => (
                    <li
                      key={scam}
                      className="inline-flex items-center rounded-full border border-gold-600/20 bg-gold-500/5 px-3 py-1 text-xs text-surface-foreground"
                    >
                      {scam}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-4 text-xs text-muted">
                We don&apos;t have a curated scam + visa primer for {safety.emergency.countryName}{' '}
                yet — the emergency numbers above are still live.
              </p>
            )}
          </Card>
        </section>
      ) : null}
    </main>
  );
}

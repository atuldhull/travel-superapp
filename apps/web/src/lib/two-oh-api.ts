/**
 * Typed client for the 2.0 surface (agent · social feed · graph).
 *
 * These controllers use TS-interface DTOs (erased at runtime), so
 * the Nest-swagger → orval SDK pipeline can't schematize them yet —
 * regenerating the SDK is a separately-tracked deferred seam. Until
 * then the established codebase pattern (see app/account/billing,
 * app/featured) is to call the exported `apiFetch` runtime directly
 * with locally-declared response types that mirror the controllers
 * 1:1. This module is the single typed seam so pages/components
 * never hand-roll a fetch.
 *
 * Auth + the httpOnly-refresh cookie are handled inside `apiFetch`
 * (CLAUDE.md rule 12). Feature-disabled (`FEATURE_AGENT_ENABLED`
 * off) surfaces as a 503 `AGENT_DISABLED` — callers treat that as
 * "no agent here", never an error.
 */
import { apiFetch } from '@app/sdk';

export type Visibility = 'PRIVATE' | 'FOLLOWERS' | 'PUBLIC';

export interface TripPublicationDto {
  readonly tripId: string;
  readonly visibility: Visibility;
  readonly exposedLat: number | null;
  readonly exposedLng: number | null;
  readonly publishedAt: string | null;
}

export interface SimilarTrip {
  readonly tripId: string;
  readonly title: string;
  readonly authorId: string;
  readonly distance: number;
}

export interface CreatorProfile {
  readonly authorId: string;
  readonly followerCount: number;
  readonly publishedCount: number;
  readonly trips: readonly TripPublicationDto[];
}

export type AgentRunStatus = 'watching' | 'closed';

export interface AgentRun {
  readonly id: string;
  readonly tripId: string;
  readonly status: AgentRunStatus;
  readonly planVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type AgentStepKind =
  | 'watch_started'
  | 'signal_seen'
  | 'proposal'
  | 'accepted'
  | 'declined'
  | 'watch_closed';

export interface AgentStep {
  readonly id: string;
  readonly agentRunId: string;
  readonly kind: AgentStepKind;
  readonly detail: Readonly<Record<string, unknown>> | null;
  readonly createdAt: string;
}

export interface AgentRunView {
  readonly run: AgentRun;
  readonly steps: readonly AgentStep[];
}

export interface ConfirmReplanResult {
  readonly status: 'accepted' | 'declined';
  readonly agentRunId: string;
}

export interface ApiErrorLike {
  readonly code?: string;
  readonly status?: number;
}

/** True when the error means "the agent feature is off here" — a
 *  first-class UI state, never a failure toast. */
export function isAgentDisabled(err: unknown): boolean {
  const e = err as ApiErrorLike;
  return e?.status === 503 || e?.code === 'AGENT_DISABLED';
}

type Envelope<T> = { data: T; status: number; headers: Headers };

async function get<T>(path: string): Promise<T> {
  const res = await apiFetch<Envelope<T>>(path, { method: 'GET' });
  return res.data;
}
async function send<T>(path: string, method: 'POST' | 'DELETE'): Promise<T> {
  const res = await apiFetch<Envelope<T>>(path, {
    method,
    body: JSON.stringify({}),
    headers: { 'content-type': 'application/json' },
  });
  return res.data;
}

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

// ─── Social feed ────────────────────────────────────────────────────────
export function getSocialFeed(opts: { limit?: number; before?: string } = {}): Promise<{
  items: readonly TripPublicationDto[];
  nextBefore: string | null;
}> {
  return get(`/api/v1/feed${qs({ limit: opts.limit, before: opts.before })}`);
}

export function getCreatorProfile(userId: string): Promise<CreatorProfile> {
  return get(`/api/v1/feed/creators/${encodeURIComponent(userId)}`);
}

export function getSimilarTrips(
  tripId: string,
  limit = 6,
): Promise<{ items: readonly SimilarTrip[] }> {
  return get(`/api/v1/feed/trips/${encodeURIComponent(tripId)}/similar${qs({ limit })}`);
}

export function publishTrip(
  tripId: string,
  body: { visibility?: Visibility; preciseGeoOptIn?: boolean } = {},
): Promise<TripPublicationDto> {
  return apiFetch<Envelope<TripPublicationDto>>(
    `/api/v1/feed/trips/${encodeURIComponent(tripId)}/publish`,
    { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } },
  ).then((r) => r.data);
}

export function unpublishTrip(tripId: string): Promise<{ unpublished: true }> {
  return send(`/api/v1/feed/trips/${encodeURIComponent(tripId)}/publish`, 'DELETE');
}

// ─── Social graph ───────────────────────────────────────────────────────
export function followUser(userId: string): Promise<{ following: true }> {
  return send(`/api/v1/users/${encodeURIComponent(userId)}/follow`, 'POST');
}
export function unfollowUser(userId: string): Promise<{ following: false }> {
  return send(`/api/v1/users/${encodeURIComponent(userId)}/follow`, 'DELETE');
}
export function blockUser(userId: string): Promise<{ blocked: true }> {
  return send(`/api/v1/users/${encodeURIComponent(userId)}/block`, 'POST');
}
export function unblockUser(userId: string): Promise<{ blocked: false }> {
  return send(`/api/v1/users/${encodeURIComponent(userId)}/block`, 'DELETE');
}

// ─── Live navigation ────────────────────────────────────────────────────
// Mirrors apps/api transport NavRoute domain 1:1 (TS-interface DTOs,
// not in the orval SDK yet — same deferred-seam reason as above).
export type NavRouteFlavor = 'fastest' | 'scenic' | 'avoid_traffic';
export type TrafficLevel = 'free' | 'moderate' | 'heavy' | 'blocked';
export type TrafficSource = 'live' | 'mock' | 'none';
export type RouteSource = 'osrm' | 'mock';

export interface NavPoint {
  readonly lat: number;
  readonly lng: number;
}
export interface TrafficSegment {
  readonly fromIndex: number;
  readonly toIndex: number;
  readonly level: TrafficLevel;
}
export interface NavAdvisory {
  readonly kind: 'blockage' | 'heavy_traffic' | 'reroute' | 'scenic_tip';
  readonly message: string;
  readonly atLat?: number;
  readonly atLng?: number;
}
export interface NavRoute {
  readonly id: string;
  readonly flavor: NavRouteFlavor;
  readonly label: string;
  readonly distanceMeters: number;
  readonly durationSeconds: number;
  readonly durationInTrafficSeconds: number;
  readonly geometry: readonly NavPoint[];
  readonly trafficSegments: readonly TrafficSegment[];
  readonly advisories: readonly NavAdvisory[];
  readonly trafficSource: TrafficSource;
}
export interface NavRouteSet {
  readonly routes: readonly NavRoute[];
  readonly recommendedRouteId: string;
  readonly routeSource: RouteSource;
}

export function getNavigation(body: {
  origin: NavPoint;
  destination: NavPoint;
  waypoints?: readonly NavPoint[];
}): Promise<NavRouteSet> {
  return apiFetch<Envelope<NavRouteSet>>(`/api/v1/transport/navigation`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }).then((r) => r.data);
}

// ─── Adventure Diary + gamification ─────────────────────────────────────
// Mirrors apps/api diary DTOs 1:1 (TS-interface DTOs, deferred SDK seam).
export interface DiaryEntryDto {
  readonly id: string;
  readonly userId: string;
  readonly tripId: string | null;
  readonly title: string;
  readonly body: string;
  readonly mood: string | null;
  readonly aiAssisted: boolean;
  readonly entryDate: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
export interface GamificationDelta {
  readonly totalPoints: number;
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly entryCount: number;
  readonly aiAssistCount: number;
  readonly lastEntryOn: string | null;
  readonly pointsAwarded: number;
  readonly newlyEarnedBadges: readonly string[];
}
export interface CreateDiaryEntryResult {
  readonly entry: DiaryEntryDto;
  readonly gamification: GamificationDelta;
}
export interface BadgeView {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  readonly earned: boolean;
}
export interface GamificationView {
  readonly totalPoints: number;
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly entryCount: number;
  readonly aiAssistCount: number;
  readonly lastEntryOn: string | null;
  readonly badges: readonly BadgeView[];
}
export type DiaryAssistMode = 'prompt' | 'polish' | 'title';
export interface DiaryAssistResult {
  readonly mode: DiaryAssistMode;
  readonly text?: string;
  readonly suggestions?: readonly string[];
  readonly aiBacked: boolean;
}

export function listDiaryEntries(opts: { tripId?: string; limit?: number } = {}): Promise<{
  entries: readonly DiaryEntryDto[];
}> {
  return get(`/api/v1/diary/entries${qs({ tripId: opts.tripId, limit: opts.limit })}`);
}
export function getGamification(): Promise<GamificationView> {
  return get(`/api/v1/diary/gamification`);
}
export function createDiaryEntry(body: {
  title: string;
  body: string;
  tripId?: string;
  mood?: string;
  aiAssisted?: boolean;
  entryDate?: string;
}): Promise<CreateDiaryEntryResult> {
  return apiFetch<Envelope<CreateDiaryEntryResult>>(`/api/v1/diary/entries`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }).then((r) => r.data);
}
export function assistDiary(body: {
  mode: DiaryAssistMode;
  text?: string;
  mood?: string;
  place?: string;
}): Promise<DiaryAssistResult> {
  return apiFetch<Envelope<DiaryAssistResult>>(`/api/v1/diary/assist`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }).then((r) => r.data);
}

// ─── Agent ──────────────────────────────────────────────────────────────
export function getAgentStatus(): Promise<{ enabled: true; phase: string }> {
  return get(`/api/v1/agent/status`);
}
export function getAgentRun(runId: string): Promise<AgentRunView> {
  return get(`/api/v1/agent/runs/${encodeURIComponent(runId)}`);
}
export function acceptProposal(proposalId: string): Promise<ConfirmReplanResult> {
  return send(`/api/v1/agent/proposals/${encodeURIComponent(proposalId)}/accept`, 'POST');
}
export function declineProposal(proposalId: string): Promise<ConfirmReplanResult> {
  return send(`/api/v1/agent/proposals/${encodeURIComponent(proposalId)}/decline`, 'POST');
}

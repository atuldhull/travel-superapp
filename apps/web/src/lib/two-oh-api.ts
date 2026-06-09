/**
 * Typed FACADE over the orval-generated SDK for the post-2.0 surface
 * (agent · social feed · graph · diary · navigation).
 *
 * This module USED to call `apiFetch` directly because the 2.0
 * controllers were originally shipped with TS-interface DTOs (no
 * Swagger decorators), and orval's emitted body / response types
 * were `void` — there was no value in piping through generated
 * functions if the resulting types were worse than hand-rolled
 * ones. That was the "two client-generation stories" the road-to-10
 * review called out.
 *
 * [E2] resolves it: every public function in this file now delegates
 * to a generated SDK function (`@app/sdk` re-exports the underlying
 * `*Controller*` plain fetchers from `packages/sdk/src/generated/
 * plain/{feed,social-graph,diary,agent,transport}/...`). The
 * HAND-ROLLED `Visibility` / `TripPublicationDto` / `AgentRun` /
 * etc. types stay here as the consumer-facing public surface —
 * they're MORE accurate than the SDK's emitted `void` types until
 * ADR-015's `@ApiBody` / `@ApiResponse` decorator rollout lands.
 * At that point this file shrinks to a one-line pass-through or
 * disappears entirely.
 *
 * Net effect: there is now ONE HTTP client (the orval SDK), and the
 * SDK's `sdk:check` CI gate ([D1] + [E1]) catches any drift.
 *
 * Auth + the httpOnly-refresh cookie are handled inside `apiFetch`
 * (CLAUDE.md rule 12), which the SDK functions delegate to.
 * Feature-disabled (`FEATURE_AGENT_ENABLED` off) surfaces as a 503
 * `AGENT_DISABLED` — callers treat that as "no agent here", never
 * an error.
 */
import {
  // feed tag
  feedControllerSocialFeed,
  feedControllerCreator,
  feedControllerSimilar,
  feedControllerBuddies,
  feedControllerPeople,
  feedControllerPublicationStatus,
  feedControllerPublish,
  feedControllerUnpublish,
  // social-graph tag
  followControllerFollow,
  followControllerUnfollow,
  followControllerBlock,
  followControllerUnblock,
  followControllerFollowers,
  followControllerFollowing,
  // social tag (comments are under social)
  commentsControllerCreate,
  commentsControllerList,
  commentsControllerRemove,
  // diary tag
  diaryControllerList,
  diaryControllerCreate,
  diaryControllerGamification,
  diaryControllerAssistEntry,
  // agent tag
  agentControllerStatus,
  agentControllerGetRun,
  agentControllerAcceptProposal,
  agentControllerDeclineProposal,
  // transport tag
  transportControllerNavigation,
} from '@app/sdk';

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
  readonly isFollowing: boolean;
  readonly isBlocked: boolean;
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

/** Unwrap a generated SDK envelope and cast the `.data` to the hand-
 *  rolled response type. The cast is the bridge between the SDK's
 *  emitted-`void` body types and the actual response shape; deletes
 *  itself when ADR-015's @ApiResponse rollout lands. */
function unwrap<T>(envelope: { data: unknown }): T {
  return envelope.data as T;
}

/** JSON body wrapper for SDK functions whose request type is `void`
 *  (no @ApiBody decorator yet). The SDK function accepts a standard
 *  `RequestInit.body`, so we marshal the typed JS object here. */
function jsonBody(body: unknown): RequestInit {
  return {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  };
}

/** Query-params helper. orval emits `params: { limit: string; ... }`
 *  with EVERY key required and string-typed because the controllers
 *  use Zod-coerced `@Query()` (the limitation ADR-015 calls out). The
 *  generated URL-builder filters `undefined` at runtime, so we cast
 *  through `unknown` to satisfy TS while keeping the call-site
 *  ergonomic. Empty / undefined values are skipped before encoding. */
function queryParams<T>(params: Record<string, string | number | undefined>): T {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    out[k] = String(v);
  }
  return out as unknown as T;
}

// ─── Social feed ────────────────────────────────────────────────────────
export async function getSocialFeed(
  opts: { limit?: number; before?: string } = {},
): Promise<{ items: readonly TripPublicationDto[]; nextBefore: string | null }> {
  return unwrap(
    await feedControllerSocialFeed(
      queryParams<Parameters<typeof feedControllerSocialFeed>[0]>({
        limit: opts.limit,
        before: opts.before,
      }),
    ),
  );
}

export async function getCreatorProfile(userId: string): Promise<CreatorProfile> {
  return unwrap(await feedControllerCreator(userId));
}

export async function getSimilarTrips(
  tripId: string,
  limit = 6,
): Promise<{ items: readonly SimilarTrip[] }> {
  return unwrap(
    await feedControllerSimilar(
      tripId,
      queryParams<Parameters<typeof feedControllerSimilar>[1]>({ limit }),
    ),
  );
}

export async function publishTrip(
  tripId: string,
  body: { visibility?: Visibility; preciseGeoOptIn?: boolean } = {},
): Promise<TripPublicationDto> {
  return unwrap(await feedControllerPublish(tripId, jsonBody(body)));
}

export async function unpublishTrip(tripId: string): Promise<{ unpublished: true }> {
  return unwrap(await feedControllerUnpublish(tripId));
}

/** J1 — owner-facing publication status for the manage-publish UI. */
export interface PublicationStatus {
  readonly published: boolean;
  readonly visibility: Visibility;
  readonly publishedAt: string | null;
  readonly exposedLat: number | null;
  readonly exposedLng: number | null;
}

export async function getTripPublication(tripId: string): Promise<PublicationStatus> {
  return unwrap(await feedControllerPublicationStatus(tripId));
}

// ─── Social graph — connections (J2) ─────────────────────────────────────

/** J2 — one user on a follower/following list. */
export interface ConnectionUser {
  readonly userId: string;
  readonly displayName: string;
  readonly followedAt: string;
}

export async function getFollowers(
  userId: string,
  limit?: number,
): Promise<{ users: ConnectionUser[] }> {
  return unwrap(
    await followControllerFollowers(
      userId,
      queryParams<Parameters<typeof followControllerFollowers>[1]>({ limit }),
    ),
  );
}

export async function getFollowing(
  userId: string,
  limit?: number,
): Promise<{ users: ConnectionUser[] }> {
  return unwrap(
    await followControllerFollowing(
      userId,
      queryParams<Parameters<typeof followControllerFollowing>[1]>({ limit }),
    ),
  );
}

/** J3 — a suggested traveller to follow (discover surface). */
export interface SuggestedTraveller {
  readonly userId: string;
  readonly displayName: string;
  readonly publishedCount: number;
}

export async function getSuggestedTravellers(
  limit?: number,
): Promise<{ travellers: SuggestedTraveller[] }> {
  return unwrap(
    await feedControllerPeople(
      queryParams<NonNullable<Parameters<typeof feedControllerPeople>[0]>>({ limit }),
    ),
  );
}

// ─── Trip comments (J4) ──────────────────────────────────────────────────

/** J4 — one comment on a published trip. */
export interface TripCommentDto {
  readonly id: string;
  readonly tripId: string;
  readonly authorId: string;
  readonly authorDisplayName: string | null;
  readonly body: string;
  readonly createdAt: string;
}

export async function getTripComments(
  tripId: string,
): Promise<{ comments: TripCommentDto[]; count: number }> {
  return unwrap(await commentsControllerList(tripId));
}

export async function postTripComment(tripId: string, body: string): Promise<TripCommentDto> {
  return unwrap(await commentsControllerCreate(tripId, jsonBody({ body })));
}

export async function deleteTripComment(commentId: string): Promise<{ deleted: true }> {
  return unwrap(await commentsControllerRemove(commentId));
}

// ─── Travel-buddy matchmaking (J5) ───────────────────────────────────────

/** J5 — a nearby PUBLIC published trip matched to yours. */
export interface TripBuddy {
  readonly tripId: string;
  readonly title: string;
  readonly authorId: string;
  readonly exposedLat: number;
  readonly exposedLng: number;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
}

export async function getTripBuddies(
  tripId: string,
  limit?: number,
): Promise<{ buddies: TripBuddy[] }> {
  return unwrap(
    await feedControllerBuddies(
      tripId,
      queryParams<Parameters<typeof feedControllerBuddies>[1]>({ limit }),
    ),
  );
}

// ─── Social graph ───────────────────────────────────────────────────────
export async function followUser(userId: string): Promise<{ following: true }> {
  return unwrap(await followControllerFollow(userId));
}
export async function unfollowUser(userId: string): Promise<{ following: false }> {
  return unwrap(await followControllerUnfollow(userId));
}
export async function blockUser(userId: string): Promise<{ blocked: true }> {
  return unwrap(await followControllerBlock(userId));
}
export async function unblockUser(userId: string): Promise<{ blocked: false }> {
  return unwrap(await followControllerUnblock(userId));
}

// ─── Live navigation ────────────────────────────────────────────────────
// Mirrors apps/api transport NavRoute domain 1:1 (TS-interface DTOs,
// pending @ApiBody decorator rollout on TransportController).
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

export async function getNavigation(body: {
  origin: NavPoint;
  destination: NavPoint;
  waypoints?: readonly NavPoint[];
}): Promise<NavRouteSet> {
  // `transportControllerNavigation`'s first arg is typed as
  // `GetNavigationRequestDto`. The DTO is an empty schema (no
  // properties surfaced by orval yet), so we cast the runtime arg
  // to satisfy the signature — the actual body shape lives on the
  // controller's Zod validator.
  return unwrap(
    await transportControllerNavigation(
      body as unknown as Parameters<typeof transportControllerNavigation>[0],
    ),
  );
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

export async function listDiaryEntries(
  opts: { tripId?: string; limit?: number } = {},
): Promise<{ entries: readonly DiaryEntryDto[] }> {
  return unwrap(
    await diaryControllerList(
      queryParams<Parameters<typeof diaryControllerList>[0]>({
        tripId: opts.tripId,
        limit: opts.limit,
      }),
    ),
  );
}
export async function getGamification(): Promise<GamificationView> {
  return unwrap(await diaryControllerGamification());
}
export async function createDiaryEntry(body: {
  title: string;
  body: string;
  tripId?: string;
  mood?: string;
  aiAssisted?: boolean;
  entryDate?: string;
}): Promise<CreateDiaryEntryResult> {
  return unwrap(await diaryControllerCreate(jsonBody(body)));
}
export async function assistDiary(body: {
  mode: DiaryAssistMode;
  text?: string;
  mood?: string;
  place?: string;
}): Promise<DiaryAssistResult> {
  return unwrap(await diaryControllerAssistEntry(jsonBody(body)));
}

// ─── Agent ──────────────────────────────────────────────────────────────
export async function getAgentStatus(): Promise<{ enabled: true; phase: string }> {
  return unwrap(await agentControllerStatus());
}
export async function getAgentRun(runId: string): Promise<AgentRunView> {
  return unwrap(await agentControllerGetRun(runId));
}
export async function acceptProposal(proposalId: string): Promise<ConfirmReplanResult> {
  return unwrap(await agentControllerAcceptProposal(proposalId));
}
export async function declineProposal(proposalId: string): Promise<ConfirmReplanResult> {
  return unwrap(await agentControllerDeclineProposal(proposalId));
}

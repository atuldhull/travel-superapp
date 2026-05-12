/**
 * Visit-recall — small localStorage helper for first-time / returning
 * visitors who haven't signed up yet. Keeps:
 *
 *   - the last city they previewed in the sample-trip widget,
 *   - the last sample plan + model (24-hour TTL — mirrors the
 *     "one-shot generation cached locally" requirement from V.UX.2),
 *   - the visit-count so the welcome-back banner only renders on
 *     the second+ visit.
 *
 * Privacy: nothing here leaves the browser. Only the city title and
 * the AI prose plan land in storage — no email, no PII.
 *
 * Auth posture (CLAUDE rule 12): this is intentionally separate from
 * `auth-store.ts` (which holds the in-memory access token).
 * localStorage is fine for ephemeral UX state (theme, last-viewed
 * trip); it's banned ONLY for tokens.
 *
 * Installed by prompt [V.UX.2].
 */
const STORAGE_KEY = 'travel.visit-recall.v1';
const SAMPLE_PLAN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface RecalledSamplePlan {
  readonly title: string;
  readonly emoji: string;
  readonly plan: string;
  readonly model: string;
  /** POST.4 — provider tier that produced the cached plan. Optional to
   *  stay backwards-compatible with entries written before POST.4
   *  shipped; readers default to 'stub' when missing. */
  readonly provider?: 'anthropic' | 'gemini' | 'ollama' | 'stub';
  /** Epoch millis at which the plan was generated. Older than 24h → ignored. */
  readonly cachedAt: number;
}

interface RecallShape {
  readonly visitCount: number;
  readonly lastSeenAt: number;
  readonly lastPlan?: RecalledSamplePlan;
}

function read(): RecallShape | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const obj = parsed as Partial<RecallShape>;
    if (typeof obj.visitCount !== 'number' || typeof obj.lastSeenAt !== 'number') return null;
    return {
      visitCount: obj.visitCount,
      lastSeenAt: obj.lastSeenAt,
      ...(obj.lastPlan ? { lastPlan: obj.lastPlan } : {}),
    };
  } catch {
    return null;
  }
}

function write(state: RecallShape): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full / disabled — silently degrade. Welcome-back
    // banner just won't fire.
  }
}

/** Bump the visit count + lastSeenAt. Call once on landing-page mount. */
export function recordVisit(): void {
  const prev = read();
  const next: RecallShape = {
    visitCount: (prev?.visitCount ?? 0) + 1,
    lastSeenAt: Date.now(),
    ...(prev?.lastPlan ? { lastPlan: prev.lastPlan } : {}),
  };
  write(next);
}

/** Returns true iff this is the user's second-or-later visit. */
export function isReturningVisitor(): boolean {
  const state = read();
  return (state?.visitCount ?? 0) >= 2;
}

/** Save the latest sample plan — used by the SampleTripDemo widget. */
export function rememberSamplePlan(plan: RecalledSamplePlan): void {
  const prev = read();
  const next: RecallShape = {
    visitCount: prev?.visitCount ?? 1,
    lastSeenAt: Date.now(),
    lastPlan: plan,
  };
  write(next);
}

/** Returns the last sample plan if it's within the 24-hour TTL. */
export function getRecalledSamplePlan(): RecalledSamplePlan | null {
  const state = read();
  if (!state?.lastPlan) return null;
  if (Date.now() - state.lastPlan.cachedAt > SAMPLE_PLAN_TTL_MS) return null;
  return state.lastPlan;
}

/** Test helper. */
export function clearVisitRecall(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

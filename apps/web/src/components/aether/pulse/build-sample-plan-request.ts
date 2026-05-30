/**
 * AE212 — pure builder for the trip-sample-plan request body.
 *
 * pulse.tsx used to inline a ternary that toggled between a
 * fresh-call body (title/center/radius) and a follow-up body
 * (title/center/radius/instruction/priorPlan). The branching is
 * easy to read but easy to break — a future "add intent field"
 * patch could miss one arm. This helper canonicalises both shapes
 * + which field is required when, so a spec can lock the contract.
 *
 * Note: this is a builder, NOT the API call. The networking + DTO
 * unwrap stays in pulse.tsx; this returns a plain object that the
 * orval-generated `tripControllerSamplePlan` accepts.
 */

export interface PulseContext {
  readonly title: string;
  readonly center: { readonly lat: number; readonly lng: number };
  readonly plan: string;
}

export interface SamplePlanRequestInputs {
  readonly title: string;
  readonly center: { readonly lat: number; readonly lng: number };
  readonly radiusKm: number;
  readonly ctx: PulseContext | null;
  readonly instruction: string;
}

export interface FreshSamplePlanBody {
  readonly title: string;
  readonly center: { readonly lat: number; readonly lng: number };
  readonly radiusKm: number;
}
export interface FollowUpSamplePlanBody extends FreshSamplePlanBody {
  readonly instruction: string;
  readonly priorPlan: string;
}
export type SamplePlanBody = FreshSamplePlanBody | FollowUpSamplePlanBody;

export function buildSamplePlanRequest(inputs: SamplePlanRequestInputs): SamplePlanBody {
  const base: FreshSamplePlanBody = {
    title: inputs.title,
    center: { lat: inputs.center.lat, lng: inputs.center.lng },
    radiusKm: inputs.radiusKm,
  };
  if (inputs.ctx === null) return base;
  return {
    ...base,
    instruction: inputs.instruction,
    priorPlan: inputs.ctx.plan,
  };
}

export function isFollowUpBody(body: SamplePlanBody): body is FollowUpSamplePlanBody {
  return 'instruction' in body;
}

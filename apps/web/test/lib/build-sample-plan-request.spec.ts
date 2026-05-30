/**
 * Vitest specs for AE212 buildSamplePlanRequest — the request-body
 * builder for the public /trips/sample-plan endpoint that Pulse
 * uses for both fresh + follow-up planning.
 */
import { describe, expect, it } from 'vitest';
import {
  buildSamplePlanRequest,
  isFollowUpBody,
} from '../../src/components/aether/pulse/build-sample-plan-request';

const CENTER = { lat: 26.9124, lng: 75.7873 };
const CTX = {
  title: 'Jaipur',
  center: { lat: 26.9124, lng: 75.7873 },
  plan: 'prior plan text\n- ruin walk\n- chai stop',
};

describe('buildSamplePlanRequest', () => {
  it('fresh call (ctx=null) returns the 3-field body', () => {
    const got = buildSamplePlanRequest({
      title: 'Leh',
      center: { lat: 34.1526, lng: 77.5771 },
      radiusKm: 50,
      ctx: null,
      instruction: 'ignored when ctx is null',
    });
    expect(got).toEqual({
      title: 'Leh',
      center: { lat: 34.1526, lng: 77.5771 },
      radiusKm: 50,
    });
    expect('instruction' in got).toBe(false);
    expect('priorPlan' in got).toBe(false);
  });

  it('follow-up (ctx set) adds instruction + priorPlan', () => {
    const got = buildSamplePlanRequest({
      title: 'Jaipur',
      center: CENTER,
      radiusKm: 50,
      ctx: CTX,
      instruction: 'make it cheaper',
    });
    expect(got).toEqual({
      title: 'Jaipur',
      center: CENTER,
      radiusKm: 50,
      instruction: 'make it cheaper',
      priorPlan: CTX.plan,
    });
  });

  it('follow-up clones center (no shared reference)', () => {
    const inputCenter = { lat: 26.9124, lng: 75.7873 };
    const got = buildSamplePlanRequest({
      title: 'Jaipur',
      center: inputCenter,
      radiusKm: 50,
      ctx: CTX,
      instruction: 'two more days',
    });
    expect(got.center).not.toBe(inputCenter);
    expect(got.center).toEqual(inputCenter);
  });

  it('priorPlan is taken from ctx, NOT from inputs.instruction', () => {
    const got = buildSamplePlanRequest({
      title: 'Leh',
      center: CENTER,
      radiusKm: 50,
      ctx: { ...CTX, plan: 'CONTEXT_PLAN' },
      instruction: 'INPUT_INSTRUCTION',
    });
    expect((got as { priorPlan: string }).priorPlan).toBe('CONTEXT_PLAN');
    expect((got as { instruction: string }).instruction).toBe('INPUT_INSTRUCTION');
  });

  it('isFollowUpBody narrows correctly', () => {
    const fresh = buildSamplePlanRequest({
      title: 't',
      center: CENTER,
      radiusKm: 1,
      ctx: null,
      instruction: '',
    });
    const followUp = buildSamplePlanRequest({
      title: 't',
      center: CENTER,
      radiusKm: 1,
      ctx: CTX,
      instruction: 'x',
    });
    expect(isFollowUpBody(fresh)).toBe(false);
    expect(isFollowUpBody(followUp)).toBe(true);
  });

  it('empty instruction on follow-up still produces a follow-up body', () => {
    const got = buildSamplePlanRequest({
      title: 't',
      center: CENTER,
      radiusKm: 1,
      ctx: CTX,
      instruction: '',
    });
    expect(isFollowUpBody(got)).toBe(true);
  });
});

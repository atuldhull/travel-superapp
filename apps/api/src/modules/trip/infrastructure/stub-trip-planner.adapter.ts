/**
 * Deterministic placeholder for the AI-trip-planner port. Returns a
 * prose plan that mentions the trip's title + dates + center; useful
 * for dev + CI + tests where we don't want to hit a real Claude API.
 *
 * Registered when `CLAUDE_API_KEY` is missing.
 *
 * Installed by prompt [IV.18.19.44].
 */
import { Injectable } from '@nestjs/common';
import type {
  TripPlannerPort,
  TripPlannerRequest,
  TripPlannerResult,
} from '../application/ports/trip-planner.port';

@Injectable()
export class StubTripPlannerAdapter implements TripPlannerPort {
  async generatePlan(req: TripPlannerRequest): Promise<TripPlannerResult> {
    const dates =
      req.startsOn && req.endsOn
        ? `${req.startsOn.toISOString().slice(0, 10)} → ${req.endsOn.toISOString().slice(0, 10)}`
        : 'no dates set';
    const plan = [
      `Stub plan for "${req.title}".`,
      `Center: ${req.center.lat.toFixed(4)}, ${req.center.lng.toFixed(4)} (radius ${req.radiusKm}km).`,
      `Dates: ${dates}.`,
      '',
      'Day 1 — Arrive, settle in, explore the immediate neighborhood.',
      'Day 2 — Visit the headline attractions; try a local lunch spot.',
      'Day 3 — Day trip to a nearby site; evening reflection.',
      '',
      'Set CLAUDE_API_KEY in the env to enable real AI-generated plans.',
    ].join('\n');
    return { plan, model: 'stub-trip-planner' };
  }
}

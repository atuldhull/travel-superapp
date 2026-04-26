/**
 * Public-facing sample-plan use-case. NO auth, NO DB — synthesizes a
 * `TripPlannerRequest` from the caller-supplied { title, center,
 * radiusKm } and delegates to whichever `TripPlannerPort` adapter is
 * registered (Claude or stub).
 *
 * Used by the landing-page demo widget so first-time visitors can
 * see the AI itinerary feature without signing up. The same global
 * rate-limiter that protects `/trips/:id/plan-with-ai` also gates
 * this endpoint.
 *
 * Installed by prompt [V.UX.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  TRIP_PLANNER_PORT,
  type TripPlannerPort,
  type TripPlannerResult,
} from './ports/trip-planner.port';

export interface GenerateSamplePlanCommand {
  readonly title: string;
  readonly center: { readonly lat: number; readonly lng: number };
  readonly radiusKm: number;
}

@Injectable()
export class GenerateSamplePlanUseCase {
  constructor(@Inject(TRIP_PLANNER_PORT) private readonly planner: TripPlannerPort) {}

  async execute(command: GenerateSamplePlanCommand): Promise<TripPlannerResult> {
    return this.planner.generatePlan({
      title: command.title,
      center: command.center,
      radiusKm: command.radiusKm,
      // Public callers don't pick dates — the planner adapters tolerate
      // null start/end and produce a generic 3-day plan.
      startsOn: null,
      endsOn: null,
    });
  }
}

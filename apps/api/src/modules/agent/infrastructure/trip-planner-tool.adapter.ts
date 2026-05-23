/**
 * POST.2A.4 — PlanTool backed by the EXISTING 1.0 trip planner.
 *
 * Delegates to TRIP_PLANNER_PORT.generatePlan (the 4-tier chain:
 * Anthropic→Gemini→Ollama→stub). NO new LLM plumbing, NO new key —
 * with zero AI keys it transparently uses the stub planner (LAW 1).
 * Only trip planning fields are sent (LAW 2).
 *
 * Installed by prompt [POST.2A.4].
 */
import { Inject, Injectable } from '@nestjs/common';
import { TRIP_PLANNER_PORT, type TripPlannerPort } from '../../trip';
import type {
  DraftReplanInput,
  DraftReplanResult,
  PlanTool,
} from '../application/ports/plan-tool.port';

const SUMMARY_MAX = 240;

function firstLine(text: string): string {
  const line =
    text
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? text.trim();
  return line.length > SUMMARY_MAX ? `${line.slice(0, SUMMARY_MAX - 1)}…` : line;
}

@Injectable()
export class TripPlannerToolAdapter implements PlanTool {
  constructor(@Inject(TRIP_PLANNER_PORT) private readonly planner: TripPlannerPort) {}

  async draftReplan(input: DraftReplanInput): Promise<DraftReplanResult> {
    const { trip, reason } = input;
    const result = await this.planner.generatePlan({
      title: `${trip.title} — re-plan (${reason})`,
      center: { lat: trip.lat, lng: trip.lng },
      radiusKm: trip.radiusKm,
      startsOn: trip.startsOn,
      endsOn: trip.endsOn,
      // POST.2C.3 — pass grounding straight through (optional; the
      // Gemini/Ollama adapters fold it, Anthropic/stub ignore it).
      ...(input.groundingContext && input.groundingContext.length > 0
        ? { groundingContext: input.groundingContext }
        : {}),
    });
    return { summary: firstLine(result.plan), provider: result.provider };
  }
}

/**
 * Anthropic Claude adapter for the trip-planner port. Calls the
 * Sonnet model with a tightly-scoped prompt: 3-5 day plan in plain
 * prose. The use-case stamps the result alongside the deterministic
 * itinerary stub so a partial AI failure never breaks the trip page.
 *
 * Construction needs CLAUDE_API_KEY at module init; the registration
 * in `trip.module.ts` is conditional so missing-key environments fall
 * back to the StubTripPlannerAdapter.
 *
 * Installed by prompt [IV.18.19.44].
 */
import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import type {
  TripPlannerPort,
  TripPlannerRequest,
  TripPlannerResult,
} from '../application/ports/trip-planner.port';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 800;

@Injectable()
export class ClaudeTripPlannerAdapter implements TripPlannerPort {
  private readonly client: Anthropic;
  private readonly log = new Logger(ClaudeTripPlannerAdapter.name);

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generatePlan(req: TripPlannerRequest): Promise<TripPlannerResult> {
    const dates =
      req.startsOn && req.endsOn
        ? `${req.startsOn.toISOString().slice(0, 10)} to ${req.endsOn.toISOString().slice(0, 10)}`
        : 'flexible dates';
    const prompt = [
      `You are a concise travel planner. Plan a trip titled "${req.title}".`,
      `Center coordinates (lat,lng): ${req.center.lat.toFixed(4)}, ${req.center.lng.toFixed(4)}.`,
      `Search radius: ${req.radiusKm}km.`,
      `Dates: ${dates}.`,
      '',
      'Output 3-5 days of plain-prose suggestions. One short paragraph per day.',
      'No markdown headings. No emoji. No preface.',
    ].join('\n');

    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as { text: string }).text)
        .join('\n')
        .trim();
      return { plan: text || '(empty response)', model: MODEL };
    } catch (err) {
      // Don't 500 the trip page when the LLM fails — surface a
      // graceful fallback so the dashboard still loads.
      this.log.warn(`claude_trip_planner_failed: ${(err as Error).message}`);
      return {
        plan: 'AI plan generation failed; the deterministic itinerary stub is still available.',
        model: MODEL,
      };
    }
  }
}

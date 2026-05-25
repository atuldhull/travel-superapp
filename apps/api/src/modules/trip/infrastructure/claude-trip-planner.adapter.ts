/**
 * Anthropic Claude adapter for the TripPlannerPort. Tier 1 of the
 * 4-tier provider chain — wins when `ANTHROPIC_API_KEY` is set.
 *
 * Behaviour:
 *   - System prompt holds the persona + output rules. Marked
 *     cache_control:'ephemeral' so repeat calls within ~5 min only
 *     bill prompt tokens for the user message — typical 70-90% cost
 *     reduction on hot paths.
 *   - User message holds the per-trip facts (title, center, radius,
 *     dates).
 *   - Output is plain prose paragraphs (no markdown / JSON parse) so
 *     the existing /trips/[id] viewer renders unchanged.
 *   - Token usage is logged via @app/logger with provider + model +
 *     input/output/cache counts so cost can be aggregated downstream.
 *   - LLM failures degrade gracefully: returns a short stub-prose
 *     fallback rather than throwing, so the trip page never 500s on
 *     a transient Anthropic outage.
 *
 * Construction needs `apiKey` + `model` at module init; the registration
 * in `trip.module.ts` is conditional so missing-key environments fall
 * through to Gemini / Ollama / Stub.
 *
 * Installed by prompt [IV.18.19.44]. Multi-provider rewrite in [POST.4].
 */
import Anthropic from '@anthropic-ai/sdk';
import { Inject, Injectable } from '@nestjs/common';
import { createLogger, type AppLogger } from '@app/logger';
import { CLOCK, type Clock } from '@app/clock';
import { CircuitBreaker, callExternal } from '@app/resilience';
import type {
  TripPlannerPort,
  TripPlannerRequest,
  TripPlannerResult,
} from '../application/ports/trip-planner.port';

const MAX_TOKENS = 1024;
// [O1] Anthropic SDK calls go through a per-instance breaker. 8s
// timeout matches the AI-latency SLO ceiling (docs/slos.md). 4
// failures open the circuit for 60s — the trip planner already
// returns a stub-prose fallback on error, so the breaker just
// shortcuts the 8s timeout once Anthropic is clearly degraded.
const REQUEST_TIMEOUT_MS = 8_000;

const SYSTEM_PROMPT =
  `You are a concise, well-travelled itinerary writer. You produce ` +
  `practical day-by-day trip plans. Output rules: 3 to 5 days. ` +
  `One short paragraph per day, separated by a blank line. Each day ` +
  `has a morning, afternoon, and evening beat, and EACH beat opens ` +
  `with an approximate clock time and the typical crowd level in ` +
  `parentheses using exactly one of (quiet), (moderate) or (busy) — ` +
  `e.g. "Morning (9am, quiet): ...". Treat the search radius as the ` +
  `trip reach: a small radius (<=10km) keeps everything to a tight ` +
  `walkable local core; a large radius (>=50km) deliberately adds ` +
  `day-trips and outlying towns. The itinerary MUST visibly change ` +
  `with the radius. Reference real neighbourhoods, landmarks, or ` +
  `cuisines if you know them — never invent specific business ` +
  `names. Avoid markdown headings, bullet lists, emoji, or any ` +
  `preface like "Here is your plan". Begin directly with ` +
  `"Day 1 — …".`;

@Injectable()
export class ClaudeTripPlannerAdapter implements TripPlannerPort {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly logger: AppLogger = createLogger('claude-trip-planner');
  private readonly breaker: CircuitBreaker;

  constructor(
    apiKey: string,
    model: string,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.breaker = new CircuitBreaker({
      name: 'anthropic',
      clock,
      failureThreshold: 4,
      openMs: 60_000,
      onTransition: (from, to, name) =>
        this.logger.warn({ from, to, name }, 'circuit_state_change'),
    });
  }

  async generatePlan(req: TripPlannerRequest): Promise<TripPlannerResult> {
    const userPrompt = this.buildUserPrompt(req);
    const startedAt = this.clock.nowMs();
    try {
      const response = await callExternal(
        () =>
          this.client.messages.create({
            model: this.model,
            max_tokens: MAX_TOKENS,
            system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
            messages: [{ role: 'user', content: userPrompt }],
          }),
        {
          breaker: this.breaker,
          timeoutMs: REQUEST_TIMEOUT_MS,
          label: 'anthropic.messages.create',
        },
      );
      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as { text: string }).text)
        .join('\n')
        .trim();
      const usage = response.usage;
      this.logger.info(
        {
          provider: 'anthropic',
          model: this.model,
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          cachedTokens: usage.cache_read_input_tokens ?? 0,
          latencyMs: this.clock.nowMs() - startedAt,
        },
        'trip_planner_claude_ok',
      );
      return {
        plan: text || '(empty response)',
        model: this.model,
        provider: 'anthropic',
        tokenUsage: {
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          cachedTokens: usage.cache_read_input_tokens ?? 0,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        { provider: 'anthropic', model: this.model, err: msg },
        'trip_planner_claude_failed',
      );
      return {
        plan: 'AI plan generation failed; the deterministic itinerary stub is still available.',
        model: this.model,
        provider: 'anthropic',
      };
    }
  }

  private buildUserPrompt(req: TripPlannerRequest): string {
    const dates =
      req.startsOn && req.endsOn
        ? `${req.startsOn.toISOString().slice(0, 10)} to ${req.endsOn.toISOString().slice(0, 10)}`
        : 'flexible dates';
    return (
      [
        `Plan a trip titled "${req.title}".`,
        `Center coordinates (lat,lng): ${req.center.lat.toFixed(4)}, ${req.center.lng.toFixed(4)}.`,
        `Search radius: ${req.radiusKm}km.`,
        `Dates: ${dates}.`,
      ].join('\n') +
      (req.instruction
        ? `\n\n${req.priorPlan ? `Current itinerary:\n${req.priorPlan}\n\n` : ''}` +
          `The traveller now asks: "${req.instruction}". Rewrite the FULL ` +
          `itinerary applying this request, keeping every output rule and ` +
          `the "Day 1 — …" format.`
        : '')
    );
  }
}

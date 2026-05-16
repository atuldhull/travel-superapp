/**
 * Google Gemini adapter for the TripPlannerPort. Tier 2 of the
 * 4-tier provider chain — wins when `ANTHROPIC_API_KEY` is unset
 * AND `GEMINI_API_KEY` is set. Free tier (~1500 req/day on Flash,
 * no credit card required, key issued by Google AI Studio).
 *
 * Uses native fetch against the REST API rather than @google/genai —
 * the wire format is stable + tiny, and avoiding the SDK keeps the
 * dep surface small and removes an upstream version pin.
 *
 * Behaviour:
 *   - System instruction holds the persona + output rules (mirrors
 *     the Claude adapter so prose style stays consistent across
 *     providers).
 *   - User content holds the per-trip facts.
 *   - Token usage is logged via @app/logger; Gemini reports promptTokenCount
 *     + candidatesTokenCount in `usageMetadata`.
 *   - LLM failures degrade gracefully: short stub-prose fallback so
 *     the trip page never 500s on a transient outage / quota burst.
 *
 * Construction needs `apiKey` + `model` at module init; the registration
 * in `trip.module.ts` is conditional so missing-key environments fall
 * through to Ollama / Stub.
 *
 * Installed by prompt [POST.4].
 */
import { Injectable } from '@nestjs/common';
import { createLogger, type AppLogger } from '@app/logger';
import { groundingPreamble } from '../application/ports/trip-planner.port';
import type {
  TripPlannerPort,
  TripPlannerRequest,
  TripPlannerResult,
} from '../application/ports/trip-planner.port';

const ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_OUTPUT_TOKENS = 1024;
const REQUEST_TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT =
  `You are a concise, well-travelled itinerary writer. You produce ` +
  `practical day-by-day trip plans. Output rules: 3 to 5 days. ` +
  `One short paragraph per day, separated by a blank line. Each day ` +
  `mentions a morning, afternoon, and evening beat. Reference real ` +
  `neighbourhoods, landmarks, or cuisines if you know them — never ` +
  `invent specific business names. Avoid markdown headings, bullet ` +
  `lists, emoji, or any preface like "Here is your plan". Begin ` +
  `directly with "Day 1 — …".`;

interface GeminiResponse {
  readonly candidates?: ReadonlyArray<{
    readonly content?: { readonly parts?: ReadonlyArray<{ readonly text?: string }> };
  }>;
  readonly usageMetadata?: {
    readonly promptTokenCount?: number;
    readonly candidatesTokenCount?: number;
    readonly cachedContentTokenCount?: number;
  };
  readonly error?: { readonly message?: string; readonly status?: string };
}

@Injectable()
export class GeminiTripPlannerAdapter implements TripPlannerPort {
  private readonly logger: AppLogger = createLogger('gemini-trip-planner');

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async generatePlan(req: TripPlannerRequest): Promise<TripPlannerResult> {
    const url = `${ENDPOINT_BASE}/${this.model}:generateContent?key=${this.apiKey}`;
    const body = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: this.buildUserPrompt(req) }] }],
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.7 },
    };
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const json = (await response.json()) as GeminiResponse;
      if (!response.ok || json.error) {
        const errMsg = json.error?.message ?? `HTTP ${response.status}`;
        this.logger.warn(
          { provider: 'gemini', model: this.model, err: errMsg, status: response.status },
          'trip_planner_gemini_http_error',
        );
        return this.fallback();
      }
      const text =
        json.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? '')
          .join('')
          .trim() ?? '';
      const usage = json.usageMetadata;
      const inputTokens = usage?.promptTokenCount ?? 0;
      const outputTokens = usage?.candidatesTokenCount ?? 0;
      const cachedTokens = usage?.cachedContentTokenCount ?? 0;
      this.logger.info(
        {
          provider: 'gemini',
          model: this.model,
          inputTokens,
          outputTokens,
          cachedTokens,
          latencyMs: Date.now() - startedAt,
        },
        'trip_planner_gemini_ok',
      );
      return {
        plan: text || '(empty response)',
        model: this.model,
        provider: 'gemini',
        tokenUsage: { inputTokens, outputTokens, cachedTokens },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        { provider: 'gemini', model: this.model, err: msg },
        'trip_planner_gemini_failed',
      );
      return this.fallback();
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildUserPrompt(req: TripPlannerRequest): string {
    const dates =
      req.startsOn && req.endsOn
        ? `${req.startsOn.toISOString().slice(0, 10)} to ${req.endsOn.toISOString().slice(0, 10)}`
        : 'flexible dates';
    return (
      // POST.2C.3 — '' when ungrounded → byte-identical to pre-2C.3.
      groundingPreamble(req.groundingContext) +
      [
        `Plan a trip titled "${req.title}".`,
        `Center coordinates (lat,lng): ${req.center.lat.toFixed(4)}, ${req.center.lng.toFixed(4)}.`,
        `Search radius: ${req.radiusKm}km.`,
        `Dates: ${dates}.`,
      ].join('\n')
    );
  }

  private fallback(): TripPlannerResult {
    return {
      plan: 'AI plan generation failed; the deterministic itinerary stub is still available.',
      model: this.model,
      provider: 'gemini',
    };
  }
}

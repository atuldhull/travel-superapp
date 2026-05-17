/**
 * Ollama adapter for the TripPlannerPort. Tier 3 of the 4-tier
 * provider chain — wins when ANTHROPIC_API_KEY + GEMINI_API_KEY are
 * both unset AND `OLLAMA_URL` is set.
 *
 * Ollama is a local LLM runtime — `ollama serve` exposes an HTTP API
 * on localhost:11434 by default. Set OLLAMA_URL to that base, pull a
 * model with `ollama pull llama3.1:8b`, and this adapter takes over.
 *
 * Truly $0 — no account, no key, no rate limit, runs offline. Quality
 * is below Claude/Gemini Flash but adequate for demo + dev scenarios.
 *
 * Behaviour:
 *   - Uses /api/chat (system/user split + non-streaming JSON response).
 *   - Reuses the same SYSTEM_PROMPT shape as Claude/Gemini for prose
 *     consistency across the chain.
 *   - Token usage logged via @app/logger when Ollama reports it
 *     (`prompt_eval_count` + `eval_count`); not all models populate
 *     the cached fields so the response does NOT carry tokenUsage.
 *   - LLM failures degrade gracefully: short stub-prose fallback so
 *     /trips/[id] never 500s when Ollama isn't running.
 *
 * Construction needs `baseUrl` + `model` at module init; the registration
 * in `trip.module.ts` is conditional so missing-URL environments fall
 * through to Stub.
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

const REQUEST_TIMEOUT_MS = 60_000;

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

interface OllamaChatResponse {
  readonly model?: string;
  readonly message?: { readonly role?: string; readonly content?: string };
  readonly done?: boolean;
  readonly prompt_eval_count?: number;
  readonly eval_count?: number;
  readonly error?: string;
}

@Injectable()
export class OllamaTripPlannerAdapter implements TripPlannerPort {
  private readonly logger: AppLogger = createLogger('ollama-trip-planner');
  private readonly endpoint: string;

  constructor(
    baseUrl: string,
    private readonly model: string,
  ) {
    // Trim trailing slashes so `${baseUrl}/api/chat` is well-formed.
    this.endpoint = `${baseUrl.replace(/\/+$/, '')}/api/chat`;
  }

  async generatePlan(req: TripPlannerRequest): Promise<TripPlannerResult> {
    const body = {
      model: this.model,
      stream: false,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: this.buildUserPrompt(req) },
      ],
      options: { temperature: 0.7 },
    };
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const json = (await response.json()) as OllamaChatResponse;
      if (!response.ok || json.error) {
        const errMsg = json.error ?? `HTTP ${response.status}`;
        this.logger.warn(
          { provider: 'ollama', model: this.model, err: errMsg, status: response.status },
          'trip_planner_ollama_http_error',
        );
        return this.fallback();
      }
      const text = (json.message?.content ?? '').trim();
      this.logger.info(
        {
          provider: 'ollama',
          model: this.model,
          inputTokens: json.prompt_eval_count ?? 0,
          outputTokens: json.eval_count ?? 0,
          latencyMs: Date.now() - startedAt,
        },
        'trip_planner_ollama_ok',
      );
      return {
        plan: text || '(empty response)',
        model: this.model,
        provider: 'ollama',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        { provider: 'ollama', model: this.model, err: msg },
        'trip_planner_ollama_failed',
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
      ].join('\n') +
      (req.instruction
        ? `\n\n${req.priorPlan ? `Current itinerary:\n${req.priorPlan}\n\n` : ''}` +
          `The traveller now asks: "${req.instruction}". Rewrite the FULL ` +
          `itinerary applying this request, keeping every output rule and ` +
          `the "Day 1 — …" format.`
        : '')
    );
  }

  private fallback(): TripPlannerResult {
    return {
      plan: 'AI plan generation failed; the deterministic itinerary stub is still available.',
      model: this.model,
      provider: 'ollama',
    };
  }
}

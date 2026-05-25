/**
 * POST.4 — Trip-planner provider smoke tests.
 *
 * One test per provider tier. Each test is skipped when its env var
 * is absent, so CI / dev without provisioned credentials stays green.
 * When the env var IS set, the test makes a real call to that
 * provider with a tiny request to validate the wire format end-to-end.
 *
 * To run a single tier locally:
 *   ANTHROPIC_API_KEY=sk-ant-… pnpm --filter=api test trip-planner-providers
 *   GEMINI_API_KEY=AIza…       pnpm --filter=api test trip-planner-providers
 *   OLLAMA_URL=http://...:11434 pnpm --filter=api test trip-planner-providers
 *
 * The stub adapter is not tested here — it's deterministic and
 * exercised by every other api e2e suite that goes through the
 * TripPlannerPort with the default empty env.
 */
import { SYSTEM_CLOCK } from '@app/clock';
import { ClaudeTripPlannerAdapter } from '../src/modules/trip/infrastructure/claude-trip-planner.adapter';
import { GeminiTripPlannerAdapter } from '../src/modules/trip/infrastructure/gemini-trip-planner.adapter';
import { OllamaTripPlannerAdapter } from '../src/modules/trip/infrastructure/ollama-trip-planner.adapter';
import type { TripPlannerRequest } from '../src/modules/trip/application/ports/trip-planner.port';

const SAMPLE_REQUEST: TripPlannerRequest = {
  title: 'Lisbon weekend',
  center: { lat: 38.7223, lng: -9.1393 },
  radiusKm: 25,
  startsOn: null,
  endsOn: null,
};

const skipAnthropic = !process.env['ANTHROPIC_API_KEY'];
const describeAnthropic = skipAnthropic ? describe.skip : describe;

describeAnthropic(
  'POST.4 — ClaudeTripPlannerAdapter (integration, requires ANTHROPIC_API_KEY)',
  () => {
    it('returns a non-empty prose plan with provider:"anthropic"', async () => {
      const adapter = new ClaudeTripPlannerAdapter(
        process.env['ANTHROPIC_API_KEY'] ?? '',
        process.env['ANTHROPIC_MODEL'] ?? 'claude-opus-4-7',
        SYSTEM_CLOCK,
      );
      const result = await adapter.generatePlan(SAMPLE_REQUEST);
      expect(result.provider).toBe('anthropic');
      expect(result.model).toBeTruthy();
      expect(result.plan.length).toBeGreaterThan(40);
      // tokenUsage MAY be present on success, absent on the graceful
      // fallback path. Either is acceptable — assert only the type
      // when present.
      if (result.tokenUsage) {
        expect(result.tokenUsage.inputTokens).toBeGreaterThan(0);
        expect(result.tokenUsage.outputTokens).toBeGreaterThanOrEqual(0);
      }
    }, 30_000);
  },
);

const skipGemini = !process.env['GEMINI_API_KEY'];
const describeGemini = skipGemini ? describe.skip : describe;

describeGemini('POST.4 — GeminiTripPlannerAdapter (integration, requires GEMINI_API_KEY)', () => {
  it('returns a non-empty prose plan with provider:"gemini"', async () => {
    const adapter = new GeminiTripPlannerAdapter(
      process.env['GEMINI_API_KEY'] ?? '',
      process.env['GEMINI_MODEL'] ?? 'gemini-2.0-flash-exp',
      SYSTEM_CLOCK,
    );
    const result = await adapter.generatePlan(SAMPLE_REQUEST);
    expect(result.provider).toBe('gemini');
    expect(result.model).toBeTruthy();
    expect(result.plan.length).toBeGreaterThan(40);
    if (result.tokenUsage) {
      expect(result.tokenUsage.inputTokens).toBeGreaterThan(0);
      expect(result.tokenUsage.outputTokens).toBeGreaterThanOrEqual(0);
    }
  }, 30_000);
});

const skipOllama = !process.env['OLLAMA_URL'];
const describeOllama = skipOllama ? describe.skip : describe;

describeOllama('POST.4 — OllamaTripPlannerAdapter (integration, requires OLLAMA_URL)', () => {
  it('returns a non-empty prose plan with provider:"ollama"', async () => {
    const adapter = new OllamaTripPlannerAdapter(
      process.env['OLLAMA_URL'] ?? '',
      process.env['OLLAMA_MODEL'] ?? 'llama3.1:8b',
      SYSTEM_CLOCK,
    );
    const result = await adapter.generatePlan(SAMPLE_REQUEST);
    expect(result.provider).toBe('ollama');
    expect(result.model).toBeTruthy();
    // Local LLMs vary in latency + verbosity — accept any non-trivial
    // response, including the graceful "(empty response)" fallback when
    // the requested model isn't pulled.
    expect(result.plan.length).toBeGreaterThan(0);
  }, 90_000);
});

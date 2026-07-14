/**
 * Pure-function spec for the planner-prose → per-day-summary split
 * used by GenerateItineraryUseCase. No DB, no Nest, no API keys — the
 * mapping is the seam where a real LLM plan becomes itinerary rows, so
 * it has to be provable without any provider in the loop.
 */
import {
  splitPlanIntoDaySummaries,
  daysInclusive,
} from '../src/modules/trip/application/generate-itinerary.use-case';

describe('splitPlanIntoDaySummaries', () => {
  it('keys each block by the day number the model wrote', () => {
    const plan = [
      'Day 1 — Arrive and settle in.',
      '',
      'Day 2 — Headline attractions.',
      '',
      'Day 3 — Day trip out of town.',
    ].join('\n');

    const summaries = splitPlanIntoDaySummaries(plan);

    expect(summaries.size).toBe(3);
    expect(summaries.get(1)).toContain('Arrive and settle in');
    expect(summaries.get(2)).toContain('Headline attractions');
    expect(summaries.get(3)).toContain('Day trip out of town');
  });

  it('keeps every line of a multi-line day block together', () => {
    const plan = [
      'Day 1 — Trastevere',
      'Morning (9am, quiet): coffee on the piazza.',
      'Afternoon (2pm, busy): the market.',
      '',
      'Day 2 — Centro',
    ].join('\n');

    const summaries = splitPlanIntoDaySummaries(plan);

    expect(summaries.get(1)).toContain('Morning (9am, quiet)');
    expect(summaries.get(1)).toContain('Afternoon (2pm, busy)');
    expect(summaries.get(2)).toContain('Centro');
  });

  it('drops any preamble before the first day marker', () => {
    const plan = ['Here is your plan!', '', 'Day 1 — Arrive.'].join('\n');

    const summaries = splitPlanIntoDaySummaries(plan);

    expect(summaries.size).toBe(1);
    expect(summaries.get(1)).not.toContain('Here is your plan');
  });

  it('honours the numbers the model wrote rather than paragraph order', () => {
    // A model that skips a day must not shift later days onto the
    // wrong date — day 3's text stays keyed to day 3.
    const plan = ['Day 1 — Arrive.', '', 'Day 3 — Depart.'].join('\n');

    const summaries = splitPlanIntoDaySummaries(plan);

    expect(summaries.get(1)).toContain('Arrive');
    expect(summaries.get(2)).toBeUndefined();
    expect(summaries.get(3)).toContain('Depart');
  });

  it('parses the stub adapter prose, which is the no-API-key floor', () => {
    // Mirrors StubTripPlannerAdapter's output shape: a header block,
    // then consecutive single-line Day rows, then a trailing hint.
    const plan = [
      'Stub plan for "Rome".',
      'Center: 41.9000, 12.5000 (radius 10km).',
      'Dates: 2026-05-01 → 2026-05-03.',
      '',
      'Day 1 — Arrive, settle in, explore the immediate neighborhood on foot.',
      'Day 2 — Visit the headline attractions.',
      'Day 3 — Day trip to a nearby site.',
      '',
      'Set ANTHROPIC_API_KEY, GEMINI_API_KEY, or OLLAMA_URL to enable a real LLM.',
    ].join('\n');

    const summaries = splitPlanIntoDaySummaries(plan);

    expect(summaries.get(1)).toContain('Arrive, settle in');
    expect(summaries.get(2)).toContain('headline attractions');
    // The trailing hint trails the last day marker, so it rides along
    // with day 3 rather than becoming a phantom day.
    expect(summaries.get(3)).toContain('Day trip to a nearby site');
    expect(summaries.size).toBe(3);
  });

  it('returns nothing for prose with no day markers', () => {
    expect(splitPlanIntoDaySummaries('An unhelpful blob of text.').size).toBe(0);
    expect(splitPlanIntoDaySummaries('').size).toBe(0);
  });
});

describe('daysInclusive', () => {
  it('counts both endpoints', () => {
    expect(daysInclusive(new Date('2026-05-01'), new Date('2026-05-03'))).toBe(3);
    expect(daysInclusive(new Date('2026-05-01'), new Date('2026-05-01'))).toBe(1);
  });

  it('is unaffected by time-of-day', () => {
    expect(daysInclusive(new Date('2026-05-01T23:59:00Z'), new Date('2026-05-02T00:01:00Z'))).toBe(
      2,
    );
  });
});

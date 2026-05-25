/**
 * POST.2A.3 — unit tests for the deterministic loop pieces.
 *
 * All pure / fake-based (no Postgres, no Redis, no network):
 *   - EvaluateSignalsUseCase: threshold + debounce rules
 *   - WeatherSignalAdapter: maps forecast → snapshot, sends NO PII
 *   - buildStatesUrl: OpenSky URL is a numeric bbox only (no PII)
 *   - acquireWatchLock: the SET NX EX race (second tick is refused)
 *
 * Installed by prompt [POST.2A.3].
 */
import { SYSTEM_CLOCK } from '@app/clock';
import { EvaluateSignalsUseCase } from '../src/modules/agent/application/evaluate-signals.use-case';
import type { SignalSnapshot } from '../src/modules/agent/application/ports/signal-source.port';
import { WeatherSignalAdapter } from '../src/modules/agent/infrastructure/weather-signal.adapter';
import { buildStatesUrl } from '../src/modules/agent/infrastructure/opensky-flight.adapter';
import {
  acquireWatchLock,
  type WatchLockRedis,
} from '../src/modules/agent/interface/agent.scheduler';
import type {
  GetDailyForecastInput,
  GetHourlyForecastInput,
  WeatherProvider,
} from '../src/modules/weather/application/ports/weather-provider';
import type {
  HourlyWeatherForecast,
  WeatherForecast,
} from '../src/modules/weather/domain/weather-forecast.entity';

const wsnap = (pct: number | null, worstDay: string | null): SignalSnapshot => ({
  kind: 'weather',
  observedAt: new Date('2026-05-16T00:00:00.000Z'),
  data: { maxPrecipProbabilityPercent: pct, worstDay },
});

describe('EvaluateSignalsUseCase (POST.2A.3, pure)', () => {
  const uc = new EvaluateSignalsUseCase();

  it('rain ≥ threshold, no previous → one move diff for the worst day', () => {
    const diffs = uc.execute({ previous: null, current: wsnap(90, '2026-06-02'), threshold: 0.7 });
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toEqual({
      op: 'move',
      stopId: '2026-06-02',
      reason: 'rain 90% on 2026-06-02',
    });
  });

  it('rain below threshold → no diff', () => {
    expect(
      uc.execute({ previous: null, current: wsnap(50, '2026-06-02'), threshold: 0.7 }),
    ).toEqual([]);
  });

  it('debounces: already over threshold last tick → no repeat diff', () => {
    expect(
      uc.execute({
        previous: wsnap(80, '2026-06-02'),
        current: wsnap(90, '2026-06-02'),
        threshold: 0.7,
      }),
    ).toEqual([]);
  });

  it('emits when crossing the threshold (was under, now over)', () => {
    const diffs = uc.execute({
      previous: wsnap(50, '2026-06-02'),
      current: wsnap(85, '2026-06-03'),
      threshold: 0.7,
    });
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.stopId).toBe('2026-06-03');
  });

  it('flight: newly delayed → diff; not delayed → none', () => {
    const fsnap = (delayed: boolean): SignalSnapshot => ({
      kind: 'flight',
      observedAt: new Date(0),
      data: { delayed },
    });
    expect(uc.execute({ previous: fsnap(false), current: fsnap(true), threshold: 0 })).toHaveLength(
      1,
    );
    expect(uc.execute({ previous: fsnap(false), current: fsnap(false), threshold: 0 })).toEqual([]);
  });

  it('geofence (no rule yet) → no diff', () => {
    const g: SignalSnapshot = { kind: 'geofence', observedAt: new Date(0), data: {} };
    expect(uc.execute({ previous: null, current: g, threshold: 0.5 })).toEqual([]);
  });
});

describe('WeatherSignalAdapter (POST.2A.3, fake provider — LAW 2 PII)', () => {
  class FakeWeather implements WeatherProvider {
    lastInput: GetDailyForecastInput | null = null;
    constructor(private readonly fail = false) {}
    async getDailyForecast(input: GetDailyForecastInput): Promise<WeatherForecast> {
      this.lastInput = input;
      if (this.fail) throw new Error('upstream down');
      return {
        lat: input.lat,
        lng: input.lng,
        timezone: 'UTC',
        days: [
          {
            date: '2026-06-01',
            maxTempC: 20,
            minTempC: 12,
            weatherCode: 1,
            precipitationProbabilityPercent: 30,
          },
          {
            date: '2026-06-02',
            maxTempC: 18,
            minTempC: 11,
            weatherCode: 61,
            precipitationProbabilityPercent: 88,
          },
        ],
      };
    }
    async getHourlyForecast(_i: GetHourlyForecastInput): Promise<HourlyWeatherForecast> {
      return { lat: 0, lng: 0, timezone: 'UTC', hours: [] };
    }
  }

  it('maps forecast → worst-day snapshot and sends ONLY lat/lng/days (no PII)', async () => {
    const fake = new FakeWeather();
    const snap = await new WeatherSignalAdapter(fake, SYSTEM_CLOCK).snapshot({
      kind: 'weather',
      lat: 48.85,
      lng: 2.35,
    });
    expect(snap.data).toEqual({ maxPrecipProbabilityPercent: 88, worstDay: '2026-06-02' });
    // The only fields that left the system:
    expect(Object.keys(fake.lastInput ?? {}).sort()).toEqual(['days', 'lat', 'lng']);
  });

  it('degrades to a deterministic null snapshot when the provider throws', async () => {
    const snap = await new WeatherSignalAdapter(new FakeWeather(true), SYSTEM_CLOCK).snapshot({
      kind: 'weather',
      lat: 1,
      lng: 2,
    });
    expect(snap.data).toEqual({ maxPrecipProbabilityPercent: null, worstDay: null });
  });
});

describe('buildStatesUrl (POST.2A.3, LAW 2 — bbox only, no PII)', () => {
  it('emits only a numeric bbox', () => {
    const url = buildStatesUrl('https://opensky-network.org/api', 48.85, 2.35);
    expect(url).toContain('/states/all?');
    expect(url).not.toContain('@');
    const qs = url.split('?')[1] ?? '';
    for (const part of qs.split('&')) {
      const [k, v] = part.split('=');
      expect(['lamin', 'lamax', 'lomin', 'lomax']).toContain(k);
      expect(Number.isFinite(Number(v))).toBe(true);
    }
  });
});

describe('acquireWatchLock (POST.2A.3, fake redis — the race)', () => {
  it('first tick acquires; concurrent second tick is refused', async () => {
    const calls: unknown[][] = [];
    let held = false;
    const redis: WatchLockRedis = {
      set: async (key, value, exFlag, ttlSeconds, nxFlag) => {
        calls.push([key, value, exFlag, ttlSeconds, nxFlag]);
        if (held) return null;
        held = true;
        return 'OK';
      },
    };
    expect(await acquireWatchLock(redis, 'w1', 60)).toBe(true);
    expect(await acquireWatchLock(redis, 'w1', 60)).toBe(false);
    expect(calls[0]).toEqual(['lock:agent:watch:w1', '1', 'EX', 60, 'NX']);
  });
});

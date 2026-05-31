/** Vitest specs for AE395 Open-Meteo helpers. */
import { describe, expect, it } from 'vitest';
import {
  isoDateOnly,
  openMeteoUrl,
  parseOpenMeteoDaily,
  weatherCodeToState,
} from '../../src/components/aether/phase1/open-meteo';

const NOW = new Date('2026-06-15T10:00:00Z');
const LEH = { lat: 34.1526, lng: 77.5771 };

describe('isoDateOnly (pure)', () => {
  it('extracts YYYY-MM-DD from a Date', () => {
    expect(isoDateOnly(new Date('2026-07-15T23:45:00Z'))).toBe('2026-07-15');
  });
  it('extracts from an ISO string', () => {
    expect(isoDateOnly('2026-08-04T00:00:00Z')).toBe('2026-08-04');
  });
  it('zero-pads month + day', () => {
    expect(isoDateOnly(new Date('2026-01-05T12:00:00Z'))).toBe('2026-01-05');
  });
  it('returns null on null / undefined / empty / invalid', () => {
    expect(isoDateOnly(null)).toBeNull();
    expect(isoDateOnly(undefined)).toBeNull();
    expect(isoDateOnly('')).toBeNull();
    expect(isoDateOnly('not a date')).toBeNull();
  });
});

describe('openMeteoUrl (pure)', () => {
  it('uses forecast endpoint for today', () => {
    const url = openMeteoUrl(LEH, NOW, NOW);
    expect(url).not.toBeNull();
    expect(url).toContain('api.open-meteo.com/v1/forecast');
  });

  it('uses forecast endpoint for near-future', () => {
    const url = openMeteoUrl(LEH, '2026-06-20T10:00:00Z', NOW);
    expect(url).toContain('api.open-meteo.com/v1/forecast');
  });

  it('uses archive endpoint for >5 days in the past', () => {
    const url = openMeteoUrl(LEH, '2026-06-01T10:00:00Z', NOW);
    expect(url).toContain('archive-api.open-meteo.com/v1/archive');
  });

  it('includes coords with 4-decimal precision', () => {
    const url = openMeteoUrl(LEH, NOW, NOW) ?? '';
    expect(url).toContain('latitude=34.1526');
    expect(url).toContain('longitude=77.5771');
  });

  it('includes start_date = end_date = target', () => {
    const url = openMeteoUrl(LEH, '2026-07-04T10:00:00Z', NOW) ?? '';
    expect(url).toContain('start_date=2026-07-04');
    expect(url).toContain('end_date=2026-07-04');
  });

  it('requests weather_code in daily', () => {
    const url = openMeteoUrl(LEH, NOW, NOW) ?? '';
    expect(url).toContain('daily=weather_code');
  });

  it('returns null on invalid date', () => {
    expect(openMeteoUrl(LEH, 'not a date', NOW)).toBeNull();
  });
});

describe('weatherCodeToState (pure)', () => {
  it('clear for codes 0..3 (clear / partly cloudy)', () => {
    expect(weatherCodeToState(0)).toBe('clear');
    expect(weatherCodeToState(1)).toBe('clear');
    expect(weatherCodeToState(2)).toBe('clear');
    expect(weatherCodeToState(3)).toBe('clear');
  });

  it('rain for drizzle / rain codes (51..67)', () => {
    expect(weatherCodeToState(51)).toBe('rain');
    expect(weatherCodeToState(61)).toBe('rain');
    expect(weatherCodeToState(67)).toBe('rain');
  });

  it('rain for snow (71..77, 85..86)', () => {
    expect(weatherCodeToState(71)).toBe('rain');
    expect(weatherCodeToState(77)).toBe('rain');
    expect(weatherCodeToState(85)).toBe('rain');
  });

  it('rain for rain showers (80..81)', () => {
    expect(weatherCodeToState(80)).toBe('rain');
    expect(weatherCodeToState(81)).toBe('rain');
  });

  it('storm for heavy showers (82) and thunderstorm (95..99)', () => {
    expect(weatherCodeToState(82)).toBe('storm');
    expect(weatherCodeToState(95)).toBe('storm');
    expect(weatherCodeToState(99)).toBe('storm');
  });

  it('clear for null / undefined / NaN / Infinity', () => {
    expect(weatherCodeToState(null)).toBe('clear');
    expect(weatherCodeToState(undefined)).toBe('clear');
    expect(weatherCodeToState(Number.NaN)).toBe('clear');
    expect(weatherCodeToState(Number.POSITIVE_INFINITY)).toBe('clear');
  });

  it('clear for unknown codes', () => {
    expect(weatherCodeToState(200)).toBe('clear');
    expect(weatherCodeToState(45)).toBe('clear'); // fog → no streaks
  });

  it('floors fractional codes', () => {
    expect(weatherCodeToState(95.4)).toBe('storm');
  });
});

describe('parseOpenMeteoDaily (pure)', () => {
  it('reads weather_code[0] from a valid payload', () => {
    expect(parseOpenMeteoDaily({ daily: { weather_code: [95] } })).toBe('storm');
    expect(parseOpenMeteoDaily({ daily: { weather_code: [61] } })).toBe('rain');
    expect(parseOpenMeteoDaily({ daily: { weather_code: [0] } })).toBe('clear');
  });

  it('"clear" on null / non-object / missing daily', () => {
    expect(parseOpenMeteoDaily(null)).toBe('clear');
    expect(parseOpenMeteoDaily('junk')).toBe('clear');
    expect(parseOpenMeteoDaily({})).toBe('clear');
    expect(parseOpenMeteoDaily({ daily: null })).toBe('clear');
  });

  it('"clear" on missing weather_code', () => {
    expect(parseOpenMeteoDaily({ daily: {} })).toBe('clear');
  });

  it('"clear" on empty / non-array weather_code', () => {
    expect(parseOpenMeteoDaily({ daily: { weather_code: [] } })).toBe('clear');
    expect(parseOpenMeteoDaily({ daily: { weather_code: 'junk' } })).toBe('clear');
  });

  it('"clear" when weather_code[0] is not a number', () => {
    expect(parseOpenMeteoDaily({ daily: { weather_code: ['x'] } })).toBe('clear');
  });
});

/** Vitest specs for AE388 weather simulation pure helpers. */
import { describe, expect, it } from 'vitest';
import {
  simulatedWeatherFor,
  weatherForSlugMonth,
  weatherHasParticles,
  weatherStreakCount,
  weatherStreakIntensity,
  type MonthZeroIndexed,
} from '../../src/components/aether/phase1/weather-simulation';

describe('weatherForSlugMonth', () => {
  it('returns "clear" for nullish / empty / unknown slugs', () => {
    expect(weatherForSlugMonth(null, 6)).toBe('clear');
    expect(weatherForSlugMonth(undefined, 6)).toBe('clear');
    expect(weatherForSlugMonth('', 6)).toBe('clear');
    expect(weatherForSlugMonth('atlantis', 6)).toBe('clear');
  });

  it('Kerala / Alleppey: rain Jun..Sep, clear otherwise', () => {
    expect(weatherForSlugMonth('kerala', 5)).toBe('rain'); // June
    expect(weatherForSlugMonth('kerala', 6)).toBe('rain');
    expect(weatherForSlugMonth('kerala', 7)).toBe('rain');
    expect(weatherForSlugMonth('kerala', 8)).toBe('rain'); // Sept
    expect(weatherForSlugMonth('kerala', 4)).toBe('clear'); // May
    expect(weatherForSlugMonth('kerala', 9)).toBe('clear'); // Oct
    expect(weatherForSlugMonth('alleppey', 6)).toBe('rain');
  });

  it('Goa / Anjuna / Andaman: same monsoon belt', () => {
    expect(weatherForSlugMonth('goa', 6)).toBe('rain');
    expect(weatherForSlugMonth('anjuna', 6)).toBe('rain');
    expect(weatherForSlugMonth('andaman', 6)).toBe('rain');
    expect(weatherForSlugMonth('goa', 1)).toBe('clear');
  });

  it('Leh / Ladakh / Spiti: storm Jul..Aug, clear otherwise', () => {
    expect(weatherForSlugMonth('leh', 6)).toBe('storm');
    expect(weatherForSlugMonth('leh', 7)).toBe('storm');
    expect(weatherForSlugMonth('leh', 5)).toBe('clear');
    expect(weatherForSlugMonth('leh', 8)).toBe('clear');
    expect(weatherForSlugMonth('ladakh', 7)).toBe('storm');
    expect(weatherForSlugMonth('spiti', 7)).toBe('storm');
  });

  it('Darjeeling: extended monsoon Jun..Oct', () => {
    expect(weatherForSlugMonth('darjeeling', 5)).toBe('rain');
    expect(weatherForSlugMonth('darjeeling', 9)).toBe('rain');
    expect(weatherForSlugMonth('darjeeling', 10)).toBe('clear');
  });

  it('Rajasthan / Jaipur: desert clear year-round', () => {
    for (let m = 0; m < 12; m += 1) {
      expect(weatherForSlugMonth('jaipur', m as MonthZeroIndexed)).toBe('clear');
      expect(weatherForSlugMonth('rajasthan', m as MonthZeroIndexed)).toBe('clear');
    }
  });

  it('Hampi: short monsoon Jul..Sep', () => {
    expect(weatherForSlugMonth('hampi', 6)).toBe('rain');
    expect(weatherForSlugMonth('hampi', 7)).toBe('rain');
    expect(weatherForSlugMonth('hampi', 8)).toBe('rain');
    expect(weatherForSlugMonth('hampi', 5)).toBe('clear');
    expect(weatherForSlugMonth('hampi', 9)).toBe('clear');
  });

  it('case-insensitive lookup', () => {
    expect(weatherForSlugMonth('KERALA', 6)).toBe('rain');
    expect(weatherForSlugMonth('Leh', 7)).toBe('storm');
  });

  it('storm wins over rain on overlap', () => {
    // If a destination had both rain[7] + storm[7] (none do today, but
    // future additions might), storm should be returned.
    // (Just assert against current data — Leh has storm[7] not rain.)
    expect(weatherForSlugMonth('leh', 7)).toBe('storm');
  });
});

describe('simulatedWeatherFor', () => {
  it('"clear" for nullish at + at=""', () => {
    expect(simulatedWeatherFor('kerala', null)).toBe('clear');
    expect(simulatedWeatherFor('kerala', undefined)).toBe('clear');
    expect(simulatedWeatherFor('kerala', '')).toBe('clear');
  });

  it('"clear" for invalid date strings', () => {
    expect(simulatedWeatherFor('kerala', 'not-a-date')).toBe('clear');
  });

  it('accepts a Date instance', () => {
    expect(simulatedWeatherFor('kerala', new Date(2026, 6, 15))).toBe('rain');
    expect(simulatedWeatherFor('leh', new Date(2026, 6, 15))).toBe('storm');
  });

  it('accepts an ISO date string', () => {
    expect(simulatedWeatherFor('kerala', '2026-07-15')).toBe('rain');
    expect(simulatedWeatherFor('leh', '2026-07-15')).toBe('storm');
    expect(simulatedWeatherFor('goa', '2026-12-15')).toBe('clear');
  });
});

describe('weatherHasParticles + weatherStreakIntensity + weatherStreakCount', () => {
  it('clear → no particles, intensity 0, count 0', () => {
    expect(weatherHasParticles('clear')).toBe(false);
    expect(weatherStreakIntensity('clear')).toBe(0);
    expect(weatherStreakCount('clear')).toBe(0);
  });

  it('rain → particles, intensity 1, count 400', () => {
    expect(weatherHasParticles('rain')).toBe(true);
    expect(weatherStreakIntensity('rain')).toBe(1);
    expect(weatherStreakCount('rain')).toBe(400);
  });

  it('storm → particles, intensity > 1, count higher than rain', () => {
    expect(weatherHasParticles('storm')).toBe(true);
    expect(weatherStreakIntensity('storm')).toBeGreaterThan(1);
    expect(weatherStreakCount('storm')).toBeGreaterThan(weatherStreakCount('rain'));
  });
});

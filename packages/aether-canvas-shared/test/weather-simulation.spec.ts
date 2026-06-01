/**
 * AE498 â€” Behavioural spec for `@app/aether-canvas-shared/src/weather-simulation.ts`.
 *
 * Pins the pure helpers that drive Atlas weather visuals so the shared sub-package
 * owns its own contract: Indian monsoon belts, high-altitude storm window, desert
 * year-round clear, storm-wins-over-rain precedence, unknown-slug fallback, and the
 * particle / intensity / count switch arms consumed by WeatherStreaks.
 */
import {
  simulatedWeatherFor,
  weatherForSlugMonth,
  weatherHasParticles,
  weatherStreakCount,
  weatherStreakIntensity,
  type MonthZeroIndexed,
  type WeatherState,
} from '../src';

describe('AE498 â€” weatherForSlugMonth: coastal monsoon belt', () => {
  it('returns rain for goa in June (month 5)', () => {
    expect(weatherForSlugMonth('goa', 5)).toBe('rain');
  });

  it('returns rain for goa in September (month 8)', () => {
    expect(weatherForSlugMonth('goa', 8)).toBe('rain');
  });

  it('returns clear for goa in May (boundary just before monsoon)', () => {
    expect(weatherForSlugMonth('goa', 4)).toBe('clear');
  });

  it('returns clear for goa in October (boundary just after monsoon)', () => {
    expect(weatherForSlugMonth('goa', 9)).toBe('clear');
  });

  it('returns rain for anjuna in July', () => {
    expect(weatherForSlugMonth('anjuna', 6)).toBe('rain');
  });

  it('returns rain for kerala and alleppey in monsoon', () => {
    expect(weatherForSlugMonth('kerala', 7)).toBe('rain');
    expect(weatherForSlugMonth('alleppey', 7)).toBe('rain');
  });

  it('returns rain for andaman during monsoon', () => {
    expect(weatherForSlugMonth('andaman', 5)).toBe('rain');
  });
});

describe('AE498 â€” weatherForSlugMonth: high altitude storm window', () => {
  it('returns storm for leh in July (month 6)', () => {
    expect(weatherForSlugMonth('leh', 6)).toBe('storm');
  });

  it('returns storm for leh in August (month 7)', () => {
    expect(weatherForSlugMonth('leh', 7)).toBe('storm');
  });

  it('returns clear for leh in June (boundary just before storm window)', () => {
    expect(weatherForSlugMonth('leh', 5)).toBe('clear');
  });

  it('returns clear for leh in September (boundary just after storm window)', () => {
    expect(weatherForSlugMonth('leh', 8)).toBe('clear');
  });

  it('returns storm for ladakh and spiti in peak summer', () => {
    expect(weatherForSlugMonth('ladakh', 6)).toBe('storm');
    expect(weatherForSlugMonth('spiti', 7)).toBe('storm');
  });
});

describe('AE498 â€” weatherForSlugMonth: extended and short monsoon belts', () => {
  it('returns rain for darjeeling through October (month 9)', () => {
    expect(weatherForSlugMonth('darjeeling', 9)).toBe('rain');
  });

  it('returns clear for darjeeling in November (one past extended monsoon)', () => {
    expect(weatherForSlugMonth('darjeeling', 10)).toBe('clear');
  });

  it('returns rain for hampi in July but clear in June (short Deccan window starts at month 6)', () => {
    expect(weatherForSlugMonth('hampi', 6)).toBe('rain');
    expect(weatherForSlugMonth('hampi', 5)).toBe('clear');
  });

  it('returns clear for hampi in September (boundary one past short window)', () => {
    expect(weatherForSlugMonth('hampi', 8)).toBe('rain');
    expect(weatherForSlugMonth('hampi', 9)).toBe('clear');
  });

  it('returns rain for varanasi and coorg during monsoon', () => {
    expect(weatherForSlugMonth('varanasi', 6)).toBe('rain');
    expect(weatherForSlugMonth('coorg', 7)).toBe('rain');
  });
});

describe('AE498 â€” weatherForSlugMonth: desert year-round clear', () => {
  it('returns clear for jaipur in every month sampled', () => {
    const months: MonthZeroIndexed[] = [0, 3, 6, 9, 11];
    for (const m of months) {
      expect(weatherForSlugMonth('jaipur', m)).toBe('clear');
    }
  });

  it('returns clear for rajasthan even in peak monsoon', () => {
    expect(weatherForSlugMonth('rajasthan', 7)).toBe('clear');
  });
});

describe('AE498 â€” weatherForSlugMonth: slug normalisation and unknown fallback', () => {
  it('lowercases the slug before lookup (GOA -> goa)', () => {
    expect(weatherForSlugMonth('GOA', 6)).toBe('rain');
  });

  it('lowercases mixed case (LeH -> leh)', () => {
    expect(weatherForSlugMonth('LeH', 7)).toBe('storm');
  });

  it('returns clear for an unknown slug', () => {
    expect(weatherForSlugMonth('atlantis', 6)).toBe('clear');
  });

  it('returns clear for an empty string slug', () => {
    expect(weatherForSlugMonth('', 6)).toBe('clear');
  });

  it('returns clear for null slug', () => {
    expect(weatherForSlugMonth(null, 6)).toBe('clear');
  });

  it('returns clear for undefined slug', () => {
    expect(weatherForSlugMonth(undefined, 6)).toBe('clear');
  });

  it('returns clear for non-string slug coerced via unknown cast', () => {
    expect(weatherForSlugMonth(42 as unknown as string, 6)).toBe('clear');
  });
});

describe('AE498 â€” simulatedWeatherFor: date parsing', () => {
  it('returns clear when at is null', () => {
    expect(simulatedWeatherFor('goa', null)).toBe('clear');
  });

  it('returns clear when at is undefined', () => {
    expect(simulatedWeatherFor('goa', undefined)).toBe('clear');
  });

  it('returns clear when at is empty string', () => {
    expect(simulatedWeatherFor('goa', '')).toBe('clear');
  });

  it('returns clear when at is an unparseable string', () => {
    expect(simulatedWeatherFor('goa', 'not-a-date')).toBe('clear');
  });

  it('uses the month from a Date instance', () => {
    // July (month index 6) â€” monsoon for goa.
    expect(simulatedWeatherFor('goa', new Date(2026, 6, 15))).toBe('rain');
  });

  it('uses the month from an ISO date string', () => {
    expect(simulatedWeatherFor('leh', '2026-07-15T10:00:00.000Z')).toBe('storm');
  });

  it('returns clear for known slug outside the rainy window', () => {
    expect(simulatedWeatherFor('goa', new Date(2026, 0, 15))).toBe('clear');
  });

  it('returns clear for unknown slug regardless of date', () => {
    expect(simulatedWeatherFor('atlantis', new Date(2026, 6, 15))).toBe('clear');
  });
});

describe('AE498 â€” weatherHasParticles', () => {
  it('returns false for clear', () => {
    expect(weatherHasParticles('clear')).toBe(false);
  });

  it('returns true for rain', () => {
    expect(weatherHasParticles('rain')).toBe(true);
  });

  it('returns true for storm', () => {
    expect(weatherHasParticles('storm')).toBe(true);
  });
});

describe('AE498 â€” weatherStreakIntensity', () => {
  it('returns 0 for clear', () => {
    expect(weatherStreakIntensity('clear')).toBe(0);
  });

  it('returns 1 for rain', () => {
    expect(weatherStreakIntensity('rain')).toBe(1);
  });

  it('returns 1.6 for storm (denser visual)', () => {
    expect(weatherStreakIntensity('storm')).toBe(1.6);
  });
});

describe('AE498 â€” weatherStreakCount', () => {
  it('returns 0 for clear (caller should not mount streaks)', () => {
    expect(weatherStreakCount('clear')).toBe(0);
  });

  it('returns 400 for rain (steady shower)', () => {
    expect(weatherStreakCount('rain')).toBe(400);
  });

  it('returns 700 for storm (denser without melting low-end GPUs)', () => {
    expect(weatherStreakCount('storm')).toBe(700);
  });

  it('returns a count strictly greater for storm than rain', () => {
    const states: WeatherState[] = ['rain', 'storm'];
    const counts = states.map(weatherStreakCount);
    expect(counts[1]).toBeGreaterThan(counts[0]);
  });
});

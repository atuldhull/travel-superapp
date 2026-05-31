/** Vitest specs for AE388 WeatherProvider + useWeather. */
// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { WeatherProvider, useWeather } from '../../src/components/aether/phase1/weather-context';

function wrap(weather?: 'clear' | 'rain' | 'storm'): React.FC<{ children: ReactNode }> {
  return function Wrap({ children }) {
    return weather === undefined ? (
      <WeatherProvider>{children}</WeatherProvider>
    ) : (
      <WeatherProvider weather={weather}>{children}</WeatherProvider>
    );
  };
}

describe('useWeather', () => {
  it('default is "clear" with no weather prop', () => {
    const { result } = renderHook(() => useWeather(), { wrapper: wrap() });
    expect(result.current).toBe('clear');
  });

  it('returns the provided value', () => {
    const { result } = renderHook(() => useWeather(), { wrapper: wrap('rain') });
    expect(result.current).toBe('rain');
  });

  it('storm propagates', () => {
    const { result } = renderHook(() => useWeather(), { wrapper: wrap('storm') });
    expect(result.current).toBe('storm');
  });

  it('outside provider → "clear" (no throw)', () => {
    const { result } = renderHook(() => useWeather());
    expect(result.current).toBe('clear');
  });
});

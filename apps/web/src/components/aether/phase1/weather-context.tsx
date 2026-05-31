'use client';

/**
 * `<WeatherProvider>` + `useWeather()` — shuttle the simulated weather
 * state into the Atlas R3F scene.
 *
 * The Atlas scene is lazy-loaded via Surface.mount and only receives
 * `{surface, phase}` from AE374, so trip/weather data needs a different
 * channel. Same pattern as TripDataProvider (AE378) + CompassBearingProvider
 * (AE379).
 *
 * Falls back to 'clear' outside the provider so the scene can be
 * rendered in Storybook fixtures without wiring weather.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { WeatherState } from './weather-simulation';

const WeatherContext = createContext<WeatherState>('clear');

export interface WeatherProviderProps {
  /** Current weather state. Default 'clear'. */
  weather?: WeatherState;
  children: ReactNode;
}

export function WeatherProvider({
  weather = 'clear',
  children,
}: WeatherProviderProps): React.ReactElement {
  return <WeatherContext.Provider value={weather}>{children}</WeatherContext.Provider>;
}

/** Read the current weather state. Falls back to 'clear' outside the
 *  provider (the scene should always have a valid value). */
export function useWeather(): WeatherState {
  return useContext(WeatherContext);
}

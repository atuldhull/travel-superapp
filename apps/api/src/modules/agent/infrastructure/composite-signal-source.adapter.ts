/**
 * Agent↔trip real triggers — the signal source the live scheduler
 * actually uses.
 *
 * Routes a snapshot query by its `kind`:
 *   - `weather` → WeatherSignalAdapter (REUSES the existing free,
 *     keyless WEATHER_PROVIDER / Open-Meteo; degrades to a
 *     deterministic "nothing observed" snapshot when offline, so
 *     `--runInBand` stays zero-key green — LAW 1).
 *   - `flight` / `geofence` / anything else → StubSignalAdapter
 *     (deterministic "no change"; OpenSky/geofence stay opt-in and
 *     are not wired into the default loop — LAW 1/LAW 2: nothing new
 *     leaves the system by default).
 *
 * This replaces the bare StubSignalAdapter binding so a real
 * weather change on a watched trip can actually be detected, while
 * the loop remains $0 and safe with no env/network.
 *
 * Installed by the agent↔trip real-triggers slice.
 */
import { Inject, Injectable } from '@nestjs/common';
import type {
  SignalSnapshot,
  SignalSource,
  SignalSourceQuery,
} from '../application/ports/signal-source.port';
import { DeadlineSignalAdapter } from './deadline-signal.adapter';
import { WeatherSignalAdapter } from './weather-signal.adapter';
import { StubSignalAdapter } from './stub-signal.adapter';

@Injectable()
export class CompositeSignalSource implements SignalSource {
  constructor(
    @Inject(WeatherSignalAdapter) private readonly weather: WeatherSignalAdapter,
    // Phase 3 (G5) — `deadline` is a pure-data adapter, no network.
    // Subscribing a watch to this kind stays opt-in (LAW 2: nothing
    // new fires by default).
    @Inject(DeadlineSignalAdapter) private readonly deadline: DeadlineSignalAdapter,
    @Inject(StubSignalAdapter) private readonly stub: StubSignalAdapter,
  ) {}

  async snapshot(query: SignalSourceQuery): Promise<SignalSnapshot> {
    if (query.kind === 'weather') {
      return this.weather.snapshot(query);
    }
    if (query.kind === 'deadline') {
      return this.deadline.snapshot(query);
    }
    return this.stub.snapshot(query);
  }
}

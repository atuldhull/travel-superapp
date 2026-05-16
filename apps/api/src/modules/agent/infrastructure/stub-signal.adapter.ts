/**
 * POST.2A.1 — the always-safe default signal source.
 *
 * Deterministic, no I/O, always reports "nothing material changed"
 * so the agent skeleton boots and tests run with zero external
 * dependencies (LAW 1). Real adapters (weather via the existing
 * WEATHER_PROVIDER port, OpenSky flight) land in POST.2A.3 behind
 * the env-gated factory; this stub stays the fallback.
 *
 * Installed by prompt [POST.2A.1].
 */
import { Injectable } from '@nestjs/common';
import type {
  SignalSnapshot,
  SignalSource,
  SignalSourceQuery,
} from '../application/ports/signal-source.port';

/** Fixed epoch so snapshots are byte-identical across runs/tests. */
const NEVER_OBSERVED = new Date(0);

@Injectable()
export class StubSignalAdapter implements SignalSource {
  async snapshot(query: SignalSourceQuery): Promise<SignalSnapshot> {
    return {
      kind: query.kind,
      observedAt: NEVER_OBSERVED,
      data: Object.freeze({ changed: false }),
    };
  }
}

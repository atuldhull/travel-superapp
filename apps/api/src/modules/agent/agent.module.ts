/**
 * Agent module (2.0, Track A).
 *
 *   controller (interface)  ── inert behind FEATURE_AGENT_ENABLED
 *     → SIGNAL_SOURCE_PORT     ← StubSignalAdapter (always-safe default)
 *     → AGENT_RUN_REPOSITORY   ← PrismaAgentRunRepository  (POST.2A.2)
 *     → TRIP_WATCH_REPOSITORY  ← PrismaTripWatchRepository (POST.2A.2)
 *     → AGENT_MEMORY_PORT      (port declared; bound in POST.2C.2)
 *     → PLAN_TOOL_PORT         (port declared; bound in POST.2A.4)
 *
 *   POST.2A.3 — the loop: EvaluateSignalsUseCase (pure), the signal
 *   adapters (WeatherSignalAdapter reuses WEATHER_PROVIDER →
 *   WeatherModule import; OpenSkyFlightAdapter free/anonymous), and
 *   AgentScheduler (setInterval + per-watch Redis lock). Coordinate-
 *   driven snapshot→propose lands in POST.2A.4.
 *
 *   DbModule is @Global so PrismaService needs no explicit import.
 *
 * Always safe to import (mirrors the env-gated optional-provider
 * pattern used elsewhere) — the conditional-import route was NOT taken
 * because Nest eagerly instantiates providers and that risks the DI
 * boot hazards documented for this codebase.
 *
 * Installed by [POST.2A.1]; persistence [POST.2A.2]; loop [POST.2A.3].
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { WeatherModule } from '../weather/weather.module';
import { TripModule } from '../trip/trip.module';
import { MediaModule } from '../media/media.module';
// POST.2C.3 — exports TRIP_GROUNDING_PORT (agent → feed inbound seam,
// hex direction preserved; feed never imports agent → no cycle).
import { FeedModule } from '../feed/feed.module';
import { AGENT_RUN_REPOSITORY } from './application/ports/agent-run.repository';
import { PLAN_TOOL_PORT } from './application/ports/plan-tool.port';
import { SIGNAL_SOURCE_PORT } from './application/ports/signal-source.port';
import { TRIP_WATCH_REPOSITORY } from './application/ports/trip-watch.repository';
import { ConfirmReplanUseCase } from './application/confirm-replan.use-case';
import { EvaluateSignalsUseCase } from './application/evaluate-signals.use-case';
import { ProposeReplanUseCase } from './application/propose-replan.use-case';
import { DraftMemoryBookUseCase } from './application/draft-memory-book.use-case';
import { StartTripWatchUseCase } from './application/start-trip-watch.use-case';
import { RunWatchCycleUseCase } from './application/run-watch-cycle.use-case';
import { TripItineraryWatchHandler } from './application/handlers/trip-itinerary-watch.handler';
import { PrismaAgentRunRepository } from './infrastructure/prisma-agent-run.repository';
import { PrismaTripWatchRepository } from './infrastructure/prisma-trip-watch.repository';
import { OpenSkyFlightAdapter } from './infrastructure/opensky-flight.adapter';
import { StubSignalAdapter } from './infrastructure/stub-signal.adapter';
import { CompositeSignalSource } from './infrastructure/composite-signal-source.adapter';
import { DeadlineSignalAdapter } from './infrastructure/deadline-signal.adapter';
import { SafetyProximitySignalAdapter } from './infrastructure/safety-proximity-signal.adapter';
import { TripPlannerToolAdapter } from './infrastructure/trip-planner-tool.adapter';
import { WeatherSignalAdapter } from './infrastructure/weather-signal.adapter';
import { AgentController } from './interface/agent.controller';
import { AgentScheduler } from './interface/agent.scheduler';

@Module({
  imports: [WeatherModule, TripModule, MediaModule, FeedModule],
  controllers: [AgentController],
  providers: [
    // Agent↔trip real triggers — the live loop routes weather to the
    // free WEATHER_PROVIDER and everything else to the safe stub
    // (degrades to "no change" offline → zero-key gate stays green).
    StubSignalAdapter,
    { provide: SIGNAL_SOURCE_PORT, useClass: CompositeSignalSource },
    { provide: AGENT_RUN_REPOSITORY, useClass: PrismaAgentRunRepository },
    { provide: TRIP_WATCH_REPOSITORY, useClass: PrismaTripWatchRepository },
    { provide: PLAN_TOOL_PORT, useClass: TripPlannerToolAdapter },
    StartTripWatchUseCase,
    EvaluateSignalsUseCase,
    ProposeReplanUseCase,
    ConfirmReplanUseCase,
    DraftMemoryBookUseCase,
    RunWatchCycleUseCase,
    TripItineraryWatchHandler,
    WeatherSignalAdapter,
    // Phase 3 (G5) — pure-data deadline reminder. Subscribing a
    // watch to 'deadline' stays opt-in; default subscribedSignals
    // are unchanged.
    DeadlineSignalAdapter,
    // Phase 6 (I4) — pure-data safety-proximity signal. Subscribing
    // a watch to 'safety_proximity' stays opt-in; the live loop
    // builds queries with only {kind,lat,lng} so nothing new fires
    // by default (LAW 2).
    SafetyProximitySignalAdapter,
    {
      // OpenSky base URL has a safe default; the adapter itself
      // degrades to "no change" on any failure (LAW 1) — no boot-time
      // reachability probe is possible, so graceful runtime fallback
      // is the correct interpretation of "real if reachable, else stub".
      provide: OpenSkyFlightAdapter,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new OpenSkyFlightAdapter(config.get('OPENSKY_BASE_URL', { infer: true })),
    },
    AgentScheduler,
  ],
  exports: [AGENT_RUN_REPOSITORY, TRIP_WATCH_REPOSITORY, StartTripWatchUseCase],
})
export class AgentModule {}

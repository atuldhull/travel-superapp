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
 *   StartTripWatchUseCase enforces the one-active-watch-per-trip
 *   invariant. The deterministic loop / scheduler that drives it
 *   lands in POST.2A.3. DbModule is @Global so PrismaService needs
 *   no explicit import.
 *
 * Always safe to import (mirrors the env-gated PaymentsModule
 * pattern) — the conditional-import route was deliberately NOT taken
 * because Nest eagerly instantiates providers and that risks the DI
 * boot hazards documented for this codebase.
 *
 * Installed by prompt [POST.2A.1]; persistence wired by [POST.2A.2].
 */
import { Module } from '@nestjs/common';
import { AGENT_RUN_REPOSITORY } from './application/ports/agent-run.repository';
import { SIGNAL_SOURCE_PORT } from './application/ports/signal-source.port';
import { TRIP_WATCH_REPOSITORY } from './application/ports/trip-watch.repository';
import { StartTripWatchUseCase } from './application/start-trip-watch.use-case';
import { PrismaAgentRunRepository } from './infrastructure/prisma-agent-run.repository';
import { PrismaTripWatchRepository } from './infrastructure/prisma-trip-watch.repository';
import { StubSignalAdapter } from './infrastructure/stub-signal.adapter';
import { AgentController } from './interface/agent.controller';

@Module({
  controllers: [AgentController],
  providers: [
    { provide: SIGNAL_SOURCE_PORT, useClass: StubSignalAdapter },
    { provide: AGENT_RUN_REPOSITORY, useClass: PrismaAgentRunRepository },
    { provide: TRIP_WATCH_REPOSITORY, useClass: PrismaTripWatchRepository },
    StartTripWatchUseCase,
  ],
  exports: [AGENT_RUN_REPOSITORY, TRIP_WATCH_REPOSITORY, StartTripWatchUseCase],
})
export class AgentModule {}

/**
 * POST.2A.1 — agent module skeleton (2.0, Track A).
 *
 *   controller (interface)  ── inert behind FEATURE_AGENT_ENABLED
 *     → SIGNAL_SOURCE_PORT  ← StubSignalAdapter (always-safe default)
 *     → AGENT_MEMORY_PORT   (port declared; bound in POST.2C.2)
 *     → PLAN_TOOL_PORT      (port declared; bound in POST.2A.4)
 *
 * Ships NO behaviour: the controller exposes only a status probe
 * that 503s when the flag is off. The deterministic loop, run log,
 * propose/confirm, and real adapters land in POST.2A.2..5. Always
 * safe to import (mirrors the env-gated PaymentsModule pattern) —
 * the conditional-import route was deliberately NOT taken because
 * Nest eagerly instantiates providers and that risks the DI boot
 * hazards documented for this codebase.
 *
 * Installed by prompt [POST.2A.1].
 */
import { Module } from '@nestjs/common';
import { SIGNAL_SOURCE_PORT } from './application/ports/signal-source.port';
import { StubSignalAdapter } from './infrastructure/stub-signal.adapter';
import { AgentController } from './interface/agent.controller';

@Module({
  controllers: [AgentController],
  providers: [{ provide: SIGNAL_SOURCE_PORT, useClass: StubSignalAdapter }],
})
export class AgentModule {}

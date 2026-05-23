/**
 * Public API of the Agent module. Cross-module CODE consumers
 * (ports, types, public use-cases) MUST import from this barrel —
 * reaching into `./domain/`, `./application/`, `./infrastructure/`,
 * or `./interface/` is forbidden by the `no-cross-module-deep-import`
 * rule in `.dependency-cruiser.cjs`.
 *
 * The ONE exception is the NestJS module class `AgentModule` —
 * cross-module DI imports use `./agent.module` directly, not this
 * barrel ([C4]: re-exporting the module class here triggered a CJS
 * partial-module cycle that bricked AppModule bootstrap).
 *
 * Authored by [B1]; module-class re-export removed by [C4].
 */

export * from './application/ports/agent-memory.port';
export * from './application/ports/agent-run.repository';
export * from './application/ports/plan-tool.port';
export * from './application/ports/signal-source.port';
export * from './application/ports/trip-watch.repository';

// Public event payload types — what cross-module subscribers
// (notifications handlers) need to read off the event bus. The
// `makeAgentEvent` factory stays private to the agent module
// (only agent use-cases mint these events).
export type { ReplanProposedEvent, ReplanProposedPayload } from './domain/agent.events';

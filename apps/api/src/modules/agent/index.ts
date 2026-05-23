/**
 * Public API of the Agent module. Cross-module consumers MUST
 * import only from this barrel — reaching into `./domain/`,
 * `./application/`, `./infrastructure/`, or `./interface/` is
 * forbidden by the `no-cross-module-deep-import` rule in
 * `.dependency-cruiser.cjs` (landing in [B2]).
 *
 * Authored by [B1] — module-boundaries hardening.
 */
export { AgentModule } from './agent.module';

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

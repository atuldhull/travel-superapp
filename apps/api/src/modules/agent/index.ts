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

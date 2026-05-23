/**
 * Public API of the Safety module. Cross-module CODE consumers
 * (ports, types, public use-cases) MUST import from this barrel —
 * reaching into `./domain/`, `./application/`, `./infrastructure/`,
 * or `./interface/` is forbidden by the `no-cross-module-deep-import`
 * rule in `.dependency-cruiser.cjs`.
 *
 * The ONE exception is the NestJS module class `SafetyModule` —
 * cross-module DI imports use `./safety.module` directly, not this
 * barrel ([C4]: re-exporting the module class here triggered a CJS
 * partial-module cycle that bricked AppModule bootstrap).
 *
 * Authored by [B1]; module-class re-export removed by [C4].
 */

export * from './application/ports/agent.repository';
export * from './application/ports/contact-notifier.port';
export * from './application/ports/crime-incident.repository';
export * from './application/ports/scam-report.repository';
export * from './application/ports/sos-event.repository';

// Public event payload types — notifications handlers fan SOS
// alerts out to trusted contacts. `makeSafetyEvent` stays private.
export type { SosTriggeredEvent, SosTriggeredPayload } from './domain/safety.events';

// Public composition surface — Trip's near-me-now reads the
// safety score for the user's current coordinates.
export { GetSafetyScoreUseCase } from './application/get-safety-score.use-case';
export type { SafetyScore } from './application/get-safety-score.use-case';

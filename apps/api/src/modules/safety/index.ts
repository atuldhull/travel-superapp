/**
 * Public API of the Safety module. Cross-module consumers MUST
 * import only from this barrel — reaching into `./domain/`,
 * `./application/`, `./infrastructure/`, or `./interface/` is
 * forbidden by the `no-cross-module-deep-import` rule in
 * `.dependency-cruiser.cjs` (landing in [B2]).
 *
 * Authored by [B1] — module-boundaries hardening.
 */
export { SafetyModule } from './safety.module';

export * from './application/ports/agent.repository';
export * from './application/ports/contact-notifier.port';
export * from './application/ports/crime-incident.repository';
export * from './application/ports/scam-report.repository';
export * from './application/ports/sos-event.repository';

// Public event payload types — notifications handlers fan SOS
// alerts out to trusted contacts. `makeSafetyEvent` stays private.
export type { SosTriggeredEvent, SosTriggeredPayload } from './domain/safety.events';

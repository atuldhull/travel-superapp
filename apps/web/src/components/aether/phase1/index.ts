/** Aether Phase 1 — Surface registry + Drift Phase 1 shell barrel. */
export { Phase1DriftShell } from './phase1-drift-shell';
export { createAetherPhase1Registry } from './aether-registry';
export {
  DEFAULT_LIFECYCLE_PLAN,
  nextPhaseInChain,
  nextScheduledPhase,
  phaseDelayFor,
  useLifecycleAutoDriver,
  type LifecyclePlan,
} from './use-lifecycle-driver';

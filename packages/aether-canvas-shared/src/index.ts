/**
 * @app/aether-canvas-shared — pure helpers consumed by both the web
 * canvas package (`@app/aether-canvas`) and the Phase 4 native canvas
 * package (`@app/aether-canvas/native`).
 *
 * Everything exported here MUST be framework-free: no React, no DOM,
 * no Three.js, no R3F. Only depends on type-only imports from
 * `@app/aether-core` (e.g. `SurfaceLifecyclePhase`).
 *
 * Phase 4 helpers will land here in subsequent slices. AE453 ships the
 * scaffold; AE454+ extract the actual modules from `apps/web/src/...`
 * and `packages/aether-canvas/src/...`.
 */

// Scaffold marker — replaced as helper modules land in AE454+.
export const AETHER_CANVAS_SHARED_VERSION = '0.0.0';

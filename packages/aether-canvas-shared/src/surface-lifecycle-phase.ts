/**
 * `SurfaceLifecyclePhase` — local canvas-shared mirror of the type
 * canonicalised in `@app/aether-core` (`./surface/types.ts`).
 *
 * Round AT (AE526) revealed that `import type { SurfaceLifecyclePhase }
 * from '@app/aether-core'` in canvas-shared made apps/mobile's
 * type-check transit through the entire aether-core barrel — which
 * has React-19 JSX components that clash with apps/mobile's
 * React-18 @types/react. Since the type is a plain union of 5 string
 * literals (no runtime, no React, no DOM) we mirror it here so the
 * canvas-shared barrel stays truly framework-free for native
 * consumers.
 *
 * The web @app/aether-core package keeps its own copy and the two
 * unions stay in lock-step by construction — both are the literal
 * 5 lifecycle phase names. A future round can collapse this to a
 * single source by having aether-core re-export from here.
 */
export type SurfaceLifecyclePhase =
  | 'idle'
  | 'materialising'
  | 'settling'
  | 'listening'
  | 'dissolving';

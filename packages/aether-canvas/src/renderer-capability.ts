/**
 * Renderer capability detection.
 *
 * Aether prefers WebGPU (better perf, deferred shading, real compute).
 * Falls back to WebGL2 on browsers that haven't shipped WebGPU yet
 * (~50% of users in 2026 — Safari 18+ has it, but iOS Safari < 18 doesn't).
 *
 * Returns a capability record the AetherScene reads to pick a renderer.
 */

export interface RendererCapability {
  /** Best supported renderer mode. */
  readonly mode: 'webgpu' | 'webgl2' | 'none';
  /** True iff WebGPU adapter request returned a real adapter. */
  readonly webgpuAvailable: boolean;
  /** True iff WebGL2 context creation succeeded. */
  readonly webgl2Available: boolean;
  /** Human-readable adapter name where available. */
  readonly adapterLabel: string | null;
}

interface MaybeGPU {
  gpu?: {
    requestAdapter?(): Promise<{ name?: string } | null>;
  };
}

/** Async detection — runs the real WebGPU adapter handshake.
 *  Safe to call during SSR (returns 'none'). */
export async function detectRenderer(): Promise<RendererCapability> {
  if (typeof navigator === 'undefined') {
    return {
      mode: 'none',
      webgpuAvailable: false,
      webgl2Available: false,
      adapterLabel: null,
    };
  }
  const nav = navigator as Navigator & MaybeGPU;
  let webgpuAvailable = false;
  let adapterLabel: string | null = null;
  if (nav.gpu?.requestAdapter !== undefined) {
    try {
      const adapter = await nav.gpu.requestAdapter();
      if (adapter !== null && adapter !== undefined) {
        webgpuAvailable = true;
        adapterLabel = adapter.name ?? 'unknown WebGPU adapter';
      }
    } catch {
      webgpuAvailable = false;
    }
  }

  let webgl2Available = false;
  if (typeof document !== 'undefined') {
    try {
      const probe = document.createElement('canvas');
      const ctx = probe.getContext('webgl2');
      webgl2Available = ctx !== null;
    } catch {
      webgl2Available = false;
    }
  }

  const mode: RendererCapability['mode'] = webgpuAvailable
    ? 'webgpu'
    : webgl2Available
      ? 'webgl2'
      : 'none';

  return { mode, webgpuAvailable, webgl2Available, adapterLabel };
}

/** Synchronous best-effort — uses cached value if available, otherwise
 *  defaults to 'webgl2' (the safe assumption in 2026). Used by the
 *  initial render before detection completes. */
export function defaultRenderer(): RendererCapability {
  return {
    mode: 'webgl2',
    webgpuAvailable: false,
    webgl2Available: true,
    adapterLabel: null,
  };
}

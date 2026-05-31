/**
 * SurfaceRegistry — boot-time data store.
 *
 * Surfaces are registered once at app boot (typically in a
 * `apps/web/src/lib/aether-registry.ts` factory) and then consumed by
 * `<SurfaceManagerProvider>` for the lifetime of the session.
 *
 * The registry is mutable-by-construction (you can `.register()` more
 * after the fact) but the read API (`.list()`) returns a frozen view so
 * downstream consumers can `useMemo` safely.
 */
import type { Surface, SurfaceId } from './types';

export class SurfaceRegistry {
  private readonly _surfaces: Surface[] = [];

  /** Register a Surface. Duplicate `id` throws — Surface IDs are the
   *  primary key the manager dispatches on, so silent overwrite would
   *  hide ordering bugs. Returns `this` so callers can fluent-chain. */
  register(surface: Surface): this {
    if (this._surfaces.some((s) => s.id === surface.id)) {
      throw new Error(`SurfaceRegistry: surface '${surface.id}' is already registered.`);
    }
    this._surfaces.push(surface);
    return this;
  }

  /** Read-only snapshot in registration order. Frozen so consumers can use
   *  the returned array as a `useMemo` dependency without worrying about
   *  identity churn (the registry recreates the array each call so it IS
   *  a new reference — pair with `.size` when you only care about churn). */
  list(): ReadonlyArray<Surface> {
    return Object.freeze([...this._surfaces]);
  }

  findById(id: SurfaceId): Surface | undefined {
    return this._surfaces.find((s) => s.id === id);
  }

  get size(): number {
    return this._surfaces.length;
  }
}

/** Bootstrap a registry from an initial seed. Convenience for tests + for
 *  the app-level factory that lists Surfaces inline. */
export function createSurfaceRegistry(seed: ReadonlyArray<Surface> = []): SurfaceRegistry {
  const r = new SurfaceRegistry();
  for (const s of seed) r.register(s);
  return r;
}

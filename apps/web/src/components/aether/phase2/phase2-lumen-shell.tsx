'use client';

/**
 * AE399 — Phase 2 Lumen shell, mounted at `/aether/memory/[id]`.
 *
 * Same shape as the Phase 1 shells (AE377/AE378/AE379) so it inherits
 * every cross-cutting capability: lifecycle FSM, palette, audio, the
 * Pulse glow, the Continuum handoff bar + receiver toast.
 *
 * Wires:
 *   1. `useMemoryBookControllerGetOne(bookId)` — the memory book DTO
 *   2. `useMediaControllerListByTrip` is the canonical "all photos for
 *      this trip" hook; Phase 2 memory books map 1:1 to a trip so we
 *      read the bound trip id off the book and fan out from there.
 *      AE400 will wire that path; AE399's first cut renders the scene
 *      with whatever photo set the data provider hands in (empty by
 *      default — the rails still appear, the user senses the time axis).
 *   3. `<TripDataProvider>` is NOT mounted here (Atlas's contract); the
 *      Lumen scene reads via `<LumenDataProvider>` instead.
 *
 * Auth gating + the dev pip + the Pulse overlay onActivate handler all
 * mirror the Phase 1 shells so the operator pattern stays one-shape.
 */
import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import { SurfaceAudioLayer, useSceneAudioBridge } from '@app/aether-audio';
import { SurfaceCanvas } from '@app/aether-canvas';
import {
  SurfaceManagerProvider,
  SurfacePaletteVars,
  useCurrentSurface,
  useSurfaceManager,
  type SurfaceMountProps,
} from '@app/aether-core';
import { openPulse } from '../pulse/open-pulse';
import { createAetherPhase1Registry } from '../phase1/aether-registry';
import { Phase1ContinuumBar } from '../phase1/phase1-continuum-bar';
import { Phase1ContinuumReceiverToast } from '../phase1/phase1-continuum-receiver-toast';
import { Phase1DevNav } from '../phase1/phase1-dev-nav';
import { Phase1PulseOverlay } from '../phase1/phase1-pulse-overlay';
import { BREATHING_LIFECYCLE_PLAN, useLifecycleAutoDriver } from '../phase1/use-lifecycle-driver';
import {
  useMemoryBookControllerGetOne,
  type MemoryBookAssetSummaryDto,
  type MemoryBookWithAssetsResponseDto,
} from '@app/sdk';
import { useAetherAuth } from '../use-aether-auth';
import { LumenDataProvider } from './lumen-data-context';
import { LumenFocusAnnouncer } from './lumen-focus-announcer';
import { LumenSelectionProvider } from './lumen-selection-context';
import type { LumenPhotoLike } from './lumen-cloud';

export interface Phase2LumenShellProps {
  readonly bookId: string;
}

export function Phase2LumenShell({ bookId }: Phase2LumenShellProps): React.ReactElement {
  const registry = useMemo(() => createAetherPhase1Registry(), []);
  const initialPathname =
    typeof window === 'undefined' ? `/aether/memory/${bookId}` : window.location.pathname;
  return (
    <SurfaceManagerProvider registry={registry} initialPathname={initialPathname}>
      <Phase2LumenInner bookId={bookId} />
    </SurfaceManagerProvider>
  );
}

function Phase2LumenInner({ bookId }: { bookId: string }): React.ReactElement {
  const pathname = usePathname();
  const { setRoute } = useSurfaceManager();
  const current = useCurrentSurface();

  useEffect(() => {
    if (typeof pathname === 'string' && pathname !== '') setRoute(pathname);
  }, [pathname, setRoute]);

  // Same breathing plan as Phase 1 shells. The audio key signature is
  // unset on Lumen's registry entry; AE376 falls back to the locked
  // Warm Italian baseline drone so the pad is still audible.
  useLifecycleAutoDriver(BREATHING_LIFECYCLE_PLAN);

  // AE400 — load the memory book + its asset summaries. The asset
  // summaries don't carry `capturedAt` / `rating` yet (those land
  // with a future SDK schema extension), so AE400 synthesises a
  // capture-time from `position` so the photos still spread across
  // the X axis. URLs are null for now — a follow-up slice can call
  // `mediaControllerDownloadUrl` per asset to fill them in.
  const { isAuthed } = useAetherAuth();
  const bookQuery = useMemoryBookControllerGetOne(bookId, {
    query: { enabled: isAuthed && bookId !== '', retry: 1 },
  });
  const photos = useMemo<ReadonlyArray<LumenPhotoLike>>(() => {
    const envelope = bookQuery.data?.data as MemoryBookWithAssetsResponseDto | undefined;
    const assets = envelope?.assets;
    if (assets === undefined || assets === null) return [];
    const total = Math.max(assets.length, 1);
    // Spread positions across a one-day synthetic window centred on now,
    // so the X axis reads as "the story unfolds left → right".
    const nowMs = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    return assets.map((a: MemoryBookAssetSummaryDto) => {
      const norm = a.position / total;
      const tMs = nowMs - ONE_DAY_MS / 2 + norm * ONE_DAY_MS;
      return {
        id: a.id,
        capturedAt: new Date(tMs).toISOString(),
        rating: null,
        url: null,
      };
    });
  }, [bookQuery.data]);
  const isPending = bookQuery.isPending;
  const isError = bookQuery.isError;

  const [audio, setAudio] = useState<{ drone: number; events: number }>({
    drone: -60,
    events: -60,
  });
  const audioBridge = useSceneAudioBridge(setAudio);

  const isDev = process.env.NODE_ENV !== 'production';
  const pipStyle: CSSProperties = {
    position: 'fixed',
    top: 12,
    left: 12,
    padding: '4px 8px',
    borderRadius: 6,
    background: 'rgba(0,0,0,0.55)',
    color: '#F2E8D5',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.04em',
    zIndex: 10,
    display: isDev ? 'block' : 'none',
  };

  return (
    <LumenSelectionProvider>
      <LumenDataProvider bookId={bookId} photos={photos} isPending={isPending} isError={isError}>
        <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
          <SurfacePaletteVars />
          <SurfaceCanvas ariaLabel={`Lumen — memory book ${bookId}`}>
            <Suspense fallback={null}>
              <ActiveSurfaceMount />
            </Suspense>
          </SurfaceCanvas>
          <SurfaceAudioLayer onChannelWrite={audioBridge.onChannelWrite} />
          <Phase1DevNav />
          <Phase1PulseOverlay onActivate={() => openPulse('')} />
          <Phase1ContinuumBar extras={{ book: bookId }} />
          <Phase1ContinuumReceiverToast />
          {/* AE403 — sr-only announcer for keyboard focus changes. */}
          <LumenFocusAnnouncer />
          <div style={pipStyle} aria-hidden>
            {current?.id ?? '—'} · book {bookId} · {photos.length} photo
            {photos.length === 1 ? '' : 's'} · audio {audioBridge.status} · drone{' '}
            {audio.drone.toFixed(0)} · events {audio.events.toFixed(0)}
          </div>
        </div>
      </LumenDataProvider>
    </LumenSelectionProvider>
  );
}

function ActiveSurfaceMount(): React.ReactElement | null {
  const current = useCurrentSurface();
  const phase = useSurfaceManager().phase;
  const Lazy = useMemo(() => {
    if (current === null || current.mount === undefined) return null;
    return lazy(
      current.mount as () => Promise<{ default: React.ComponentType<SurfaceMountProps> }>,
    );
  }, [current]);
  if (Lazy === null || current === null) return null;
  return <Lazy surface={current} phase={phase} />;
}

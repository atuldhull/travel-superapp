'use client';

/**
 * AE398 — `<LumenDataProvider>` + `useLumenData()`.
 *
 * Same shuttle pattern AE378 uses for Atlas: the Lumen surface is
 * lazy-loaded via `Surface.mount` and only receives `{surface, phase}`
 * from AE374's `SurfaceMountProps`. Trip-bound data (the memory book
 * + the photos that hang in the cloud) needs a different channel.
 *
 * Defaults to an empty cloud outside the provider so the scene can be
 * rendered in Storybook fixtures + jsdom tests without wiring the SDK.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { LumenPhotoLike } from './lumen-cloud';

export interface LumenDataValue {
  /** Memory book id this Lumen scene is bound to. */
  readonly bookId: string | null;
  /** Photo set — empty + non-null while the SDK call resolves. */
  readonly photos: ReadonlyArray<LumenPhotoLike>;
  /** True until the underlying useMediaController* hooks settle. */
  readonly isPending: boolean;
  /** True when the SDK call errored. */
  readonly isError: boolean;
}

const EMPTY: LumenDataValue = Object.freeze({
  bookId: null,
  photos: [],
  isPending: false,
  isError: false,
});

const LumenDataContext = createContext<LumenDataValue>(EMPTY);

export interface LumenDataProviderProps {
  readonly bookId: string | null;
  readonly photos: ReadonlyArray<LumenPhotoLike>;
  readonly isPending?: boolean;
  readonly isError?: boolean;
  children: ReactNode;
}

export function LumenDataProvider({
  bookId,
  photos,
  isPending = false,
  isError = false,
  children,
}: LumenDataProviderProps): React.ReactElement {
  return (
    <LumenDataContext.Provider value={{ bookId, photos, isPending, isError }}>
      {children}
    </LumenDataContext.Provider>
  );
}

export function useLumenData(): LumenDataValue {
  return useContext(LumenDataContext);
}

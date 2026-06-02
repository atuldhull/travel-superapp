/**
 * Sample Lumen photo set for the Aether mobile preview (Phase 4 AE548).
 *
 * Until the Lumen route wires to a real memory book via the media SDK,
 * the preview renders this fixed set so the photo cloud demos on a
 * fresh install. Shape matches `LumenPhotoLike` from
 * `@app/aether-canvas-shared` exactly.
 *
 * `url` is null for every photo — the first-cut mobile Lumen scene
 * paints solid palette-tinted planes rather than textures (Expo Asset
 * texture loading is a later wrinkle). The `capturedAt` spread drives
 * the X axis; the `rating` drives the Y axis.
 */
import type { LumenPhotoLike } from '@app/aether-canvas-shared';

export const SAMPLE_LUMEN_PHOTOS: ReadonlyArray<LumenPhotoLike> = [
  { id: 'p-1', capturedAt: '2026-06-10T07:30:00.000Z', rating: 5, url: null },
  { id: 'p-2', capturedAt: '2026-06-10T11:15:00.000Z', rating: 3, url: null },
  { id: 'p-3', capturedAt: '2026-06-10T18:40:00.000Z', rating: 4, url: null },
  { id: 'p-4', capturedAt: '2026-06-11T09:05:00.000Z', rating: 2, url: null },
  { id: 'p-5', capturedAt: '2026-06-11T14:20:00.000Z', rating: 5, url: null },
  { id: 'p-6', capturedAt: '2026-06-11T19:55:00.000Z', rating: null, url: null },
  { id: 'p-7', capturedAt: '2026-06-12T08:10:00.000Z', rating: 4, url: null },
  { id: 'p-8', capturedAt: '2026-06-12T13:45:00.000Z', rating: 3, url: null },
  { id: 'p-9', capturedAt: '2026-06-12T17:30:00.000Z', rating: 5, url: null },
  { id: 'p-10', capturedAt: '2026-06-13T10:00:00.000Z', rating: 1, url: null },
  { id: 'p-11', capturedAt: '2026-06-13T15:25:00.000Z', rating: 4, url: null },
  { id: 'p-12', capturedAt: '2026-06-13T20:15:00.000Z', rating: null, url: null },
];

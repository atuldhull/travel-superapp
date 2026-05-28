'use client';

/**
 * Client-side lazy boundary for the Drift surface.
 *
 * Next 15 disallows `ssr: false` with `next/dynamic` inside Server
 * Components. The page.tsx is a Server Component (so it can read
 * env + call notFound()), so the dynamic-with-ssr-false has to live
 * inside this Client Component instead. Same end result: DriftShell
 * (R3F + Tone.js + WebGPU) only loads in the browser.
 */
import dynamic from 'next/dynamic';

export const DriftLazy = dynamic(async () => (await import('./drift-shell')).DriftShell, {
  ssr: false,
});

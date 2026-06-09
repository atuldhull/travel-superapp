'use client';

/**
 * Lazy boundary for <GlobalAssistant>. Keeps framer-motion + the SDK plan
 * calls out of the shared baseline that every route loads — the assistant
 * only renders a closed FAB on first paint, so ssr:false is safe (it uses
 * window/localStorage/speech and has no above-the-fold/SEO value).
 */
import dynamic from 'next/dynamic';

export const GlobalAssistant = dynamic(
  async () => (await import('./global-assistant')).GlobalAssistant,
  { ssr: false },
);

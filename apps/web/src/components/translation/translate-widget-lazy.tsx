'use client';

/**
 * Lazy boundary for <TranslateWidget>. Pulls @app/sdk; it's a bottom-left
 * affordance with nothing above-the-fold, so ssr:false moves it off the
 * shared baseline every route pays.
 */
import dynamic from 'next/dynamic';

export const TranslateWidget = dynamic(
  async () => (await import('./translate-widget')).TranslateWidget,
  { ssr: false },
);

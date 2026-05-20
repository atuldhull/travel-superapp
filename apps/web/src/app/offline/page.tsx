/**
 * I1 — Offline fallback. Served when the SW catches a navigation
 * failure (no network, captive portal, dropped tunnel). The page is
 * pre-cached on SW install so it renders even with the network down.
 *
 * Honest scope:
 *  - We don't try to enumerate cached trips here — the SW only caches
 *    THIS page. I2 puts trip overviews into IndexedDB and the
 *    individual trip + recap pages read from IDB with an "Offline"
 *    badge. Until I2 lands, we point the user at /home and the
 *    already-offline-capable /navigate.
 *  - No client JS needed — pure RSC. Smaller cached payload, faster
 *    paint when the device is on a flaky connection.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { CloudOff, Map, Home, BookOpen } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Offline — TravelSuperApp',
  description: 'You are offline. Cached trip data remains available.',
};

export default function OfflinePage() {
  return (
    <section className="space-y-6 py-10">
      <header className="space-y-3 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold-600/30 bg-surface/70 shadow-(--shadow-depth-1)">
          <CloudOff aria-hidden="true" className="h-7 w-7 text-gold-600" />
        </div>
        <h1 className="font-display text-3xl text-surface-foreground sm:text-4xl">
          You&apos;re offline
        </h1>
        <p className="mx-auto max-w-md text-sm text-muted">
          The network blinked. The trip you&apos;ve already opened in this browser stays available —
          just open it again. Maps you downloaded on{' '}
          <Link href="/navigate" className="text-gold-600 underline-offset-4 hover:underline">
            Navigate
          </Link>{' '}
          keep working too.
        </p>
      </header>
      <ul className="mx-auto grid max-w-md gap-3 sm:grid-cols-3">
        <li>
          <Link
            href="/home"
            className="flex flex-col items-center gap-2 rounded-2xl border border-gold-600/15 bg-surface/70 p-4 text-sm text-surface-foreground shadow-(--shadow-depth-1) transition hover:border-gold-600/40 hover:bg-surface"
          >
            <Home aria-hidden="true" className="h-5 w-5 text-gold-600" />
            Home
          </Link>
        </li>
        <li>
          <Link
            href="/navigate"
            className="flex flex-col items-center gap-2 rounded-2xl border border-gold-600/15 bg-surface/70 p-4 text-sm text-surface-foreground shadow-(--shadow-depth-1) transition hover:border-gold-600/40 hover:bg-surface"
          >
            <Map aria-hidden="true" className="h-5 w-5 text-gold-600" />
            Offline map
          </Link>
        </li>
        <li>
          <Link
            href="/diary"
            className="flex flex-col items-center gap-2 rounded-2xl border border-gold-600/15 bg-surface/70 p-4 text-sm text-surface-foreground shadow-(--shadow-depth-1) transition hover:border-gold-600/40 hover:bg-surface"
          >
            <BookOpen aria-hidden="true" className="h-5 w-5 text-gold-600" />
            Diary
          </Link>
        </li>
      </ul>
      <p className="text-center text-xs text-muted">
        We&apos;ll reconnect automatically when service returns.
      </p>
    </section>
  );
}

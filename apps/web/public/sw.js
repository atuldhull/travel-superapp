/**
 * Service worker — two phases of responsibility stacked in one file:
 *
 *   1. (V.UX.26) Web Push — render OS-level notifications + focus
 *      tabs on `notificationclick`. Unchanged from the V.UX.26 ship.
 *   2. (I1, Phase 6) PWA offline fallback — cache `/offline` on
 *      install; on a failed navigation, serve that cached page so the
 *      user lands on a calm "you're offline" surface instead of the
 *      browser error.
 *
 * Honest scope: this SW does NOT proactively pre-cache trip data,
 * map tiles, or auth-bearing API calls. Trip data + country primer
 * are cached at the application layer via IndexedDB (I2/I3) so the
 * pages themselves stay aware of staleness and badge it. Map tiles
 * already use `OfflineVectorMap` + `offline-region.ts` from /navigate
 * — the SW does not touch them.
 *
 * Installed by [V.UX.26]; offline fallback added by [Phase-6/I1].
 * Next.js serves `apps/web/public/sw.js` verbatim from the same
 * origin (port 3001).
 */
'use strict';

/** Bump the version to force a fresh shell cache on the next visit. */
const OFFLINE_CACHE = 'travel-app-offline-v2';
const OFFLINE_URL = '/offline.html';
/** Files we want to live in the offline cache so the fallback page
 *  renders even without the network. `/offline.html` is a fully
 *  self-contained static file (inline CSS + inline SVG, no /_next
 *  chunks) so it paints correctly on a cold offline load — a Next
 *  App Router route would link external CSS the SW doesn't cache. */
const APP_SHELL = [OFFLINE_URL];

self.addEventListener('install', (event) => {
  // Pre-cache the offline page and activate immediately on first
  // install — no orphan SW from a prior version sitting around.
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(OFFLINE_CACHE);
        await cache.addAll(APP_SHELL);
      } catch (_err) {
        /* offline cache is best-effort — push still works without it */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  // Reap stale offline-cache versions; keep only OFFLINE_CACHE.
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((k) => k.startsWith('travel-app-offline-') && k !== OFFLINE_CACHE)
            .map((k) => caches.delete(k)),
        );
      } catch (_err) {
        /* best-effort cleanup */
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only handle same-origin top-level navigations. API calls
  // (cross-origin to :3000), assets, and partial fetches stay
  // untouched — those have their own caching strategy or rely on the
  // app's online-aware UI states (I2/I3 will mark trips "Offline"
  // explicitly from the React layer).
  if (req.mode !== 'navigate') return;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      try {
        // Network-first so live navigations always get the fresh page.
        // The 8s timeout keeps us from hanging on a captive portal.
        const networkResp = await Promise.race([
          fetch(req),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('sw-network-timeout')), 8000),
          ),
        ]);
        return networkResp;
      } catch (_err) {
        const cache = await caches.open(OFFLINE_CACHE);
        const cached = await cache.match(OFFLINE_URL);
        if (cached) return cached;
        // No cached fallback — let the browser render its native error.
        return new Response(
          '<!doctype html><meta charset="utf-8"><title>Offline</title><p>You are offline.</p>',
          { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } },
        );
      }
    })(),
  );
});

self.addEventListener('push', (event) => {
  let data;
  try {
    data = event.data ? event.data.json() : {};
  } catch (_err) {
    data = { title: 'TravelSuperApp', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'TravelSuperApp';
  const options = {
    body: data.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: {
      url: data.url || '/inbox',
      templateKey: data.templateKey || null,
    },
    tag: data.templateKey || 'travel-app-push',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/inbox';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        try {
          const u = new URL(client.url);
          if (u.pathname === targetUrl || client.url.endsWith(targetUrl)) {
            return client.focus();
          }
        } catch (_err) {
          /* skip malformed client url */
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return null;
    }),
  );
});

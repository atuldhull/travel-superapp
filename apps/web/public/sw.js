/**
 * V.UX.26 — Web Push service worker.
 *
 * Two responsibilities:
 *   1. `push` — render an OS-level notification from the encrypted
 *      payload the api signed with VAPID. Payload shape mirrors the
 *      `WebPushPayload` interface in `web-push-dispatcher.ts`:
 *          { title, body, url?, templateKey, context }
 *   2. `notificationclick` — focus an existing tab pointed at `url`,
 *      or open a new one. Falls back to the app root.
 *
 * Installed by prompt [V.UX.26]. No build step — Next.js serves
 * `apps/web/public/sw.js` verbatim from the same origin.
 */
'use strict';

self.addEventListener('install', (event) => {
  // Activate immediately on first install — no orphan SW from a
  // prior version sitting around.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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

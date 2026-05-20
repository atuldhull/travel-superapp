/**
 * I1 — PWA registration. Mounted once at the root layout, this
 * client component registers `/sw.js` for every visitor (not just
 * Web Push subscribers — V.UX.26's `ensureWebPushSubscription` also
 * registers, but only after the user opts into notifications).
 *
 * Registration is idempotent: the browser dedupes by scope+script,
 * and our SW's `install` handler is safe to re-enter. We skip
 * registration in development to avoid stale-shell loops while
 * editing /offline and the SW itself; restart the dev server to
 * clear the previous registration, or use Chrome devtools "Unregister".
 *
 * No UI — the install-prompt affordance is its own component (I6).
 */
'use client';

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // In dev, unregister any prior SW so hot-reload of /offline or
    // /sw.js isn't shadowed by a stale install. Prod is where the
    // offline fallback actually matters.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => {
          /* best-effort — if dev unregister fails the page still works */
        });
      return;
    }
    // Production — register on idle so it never competes with the
    // initial paint. `register()` rejects silently on insecure
    // origins (http://) which is fine in local network previews.
    const idle =
      'requestIdleCallback' in window
        ? (cb: () => void) =>
            (
              window as unknown as { requestIdleCallback: (cb: () => void) => number }
            ).requestIdleCallback(cb)
        : (cb: () => void) => window.setTimeout(cb, 1500);
    idle(() => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        /* SW registration is best-effort; the app works without it */
      });
    });
  }, []);
  return null;
}

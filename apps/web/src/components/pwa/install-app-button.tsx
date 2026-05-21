/**
 * I6 (Phase 6) — install-app affordance.
 *
 * Chromium fires `beforeinstallprompt` when the PWA is installable
 * (valid manifest + registered SW + engagement heuristic). We catch
 * it, suppress the default mini-infobar, and surface our own subtle
 * button. Tapping it replays the stored event's `prompt()`.
 *
 * Honest behaviour:
 *  - Renders NOTHING until the browser says the app is installable.
 *    Safari / Firefox never fire the event → the button never shows
 *    (they install via the share sheet instead — not our surface).
 *  - Hides itself permanently once `appinstalled` fires, and also
 *    when the app is already running in standalone display mode.
 *  - One dismissal is remembered in localStorage so we don't nag.
 *
 * Installed for Phase 6 (I6).
 */
'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

/** Minimal shape of the non-standard `beforeinstallprompt` event. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'travel-web-pwa-install-dismissed';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS exposes `navigator.standalone`; everyone else uses the media
  // query. Either means the app is already installed + launched.
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

export function InstallAppButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone()) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      /* localStorage unavailable — treat as not-dismissed */
    }
    if (dismissed) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    const onInstalled = () => {
      setDeferred(null);
      setHidden(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (hidden || !deferred) return null;

  const install = async () => {
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* user-gesture / double-prompt errors aren't worth surfacing */
    }
    // The event is single-use — clear it whichever way the choice went.
    setDeferred(null);
    setHidden(true);
  };

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* best-effort */
    }
    setHidden(true);
  };

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-gold-600/20 bg-gold-500/8 px-4 py-2.5">
      <Download aria-hidden className="h-4 w-4 shrink-0 text-gold-600" />
      <p className="min-w-0 flex-1 text-sm text-surface-foreground">
        Install TravelSuperApp for offline trips, phrases, and faster launch.
      </p>
      <button
        type="button"
        onClick={install}
        className="shrink-0 rounded-full bg-gold-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gold-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Install
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="shrink-0 rounded-full px-2 py-1.5 text-xs text-muted transition hover:text-surface-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Not now
      </button>
    </div>
  );
}

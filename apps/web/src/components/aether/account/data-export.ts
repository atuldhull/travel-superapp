/**
 * AE131 helper — gather every Aether-stored localStorage fact into a
 * single JSON payload. Extracted from `account-page.tsx` in AE136 so
 * the bundling shape can be unit-tested without rendering the page.
 *
 * Privacy contract: this MUST stay limited to client-owned local
 * state. Tokens live in memory + httpOnly cookies and are NOT exposed
 * here; bumping the version means re-auditing the field list.
 */

export interface AetherLocalDataPayload {
  readonly version: 1;
  readonly exportedAt: string;
  readonly source: 'aether-account';
  /** AE106 — the Pulse long-memory list, or null when never written. */
  readonly recentPrompts: unknown;
  /** AE72 — the Pulse short-memory conversation, or null. */
  readonly pulseHistory: unknown;
  /** AE94 — every `aether-checklist:<tripId>:v1` keyed by full storage key. */
  readonly checklists: Record<string, unknown>;
  /** AE46 — true if the welcome has been seen on this device. */
  readonly onboarded: boolean;
  /** AE32 — true if the user opted out of audio. */
  readonly audioOptOut: boolean;
}

function safeRead(storage: Storage, key: string): unknown {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** AE160 — Pulse-history-only backup payload (smaller than the full
 *  AE131 bundle). Used by the "Backup .json" button next to Clear. */
export interface AetherPulseHistoryPayload {
  readonly version: 1;
  readonly exportedAt: string;
  readonly source: 'aether-pulse';
  readonly history: unknown;
}

/** Pure helper for the AE140 Pulse-history backup. */
export function bundlePulseHistory(
  storage: Storage,
  now: Date = new Date(),
): AetherPulseHistoryPayload {
  return {
    version: 1,
    exportedAt: now.toISOString(),
    source: 'aether-pulse',
    history: safeRead(storage, 'aether-pulse-history:v1'),
  };
}

/** Pure helper — accepts a Storage so tests can pass a fresh mock and
 *  the production code passes `window.localStorage`. */
export function bundleLocalData(storage: Storage, now: Date = new Date()): AetherLocalDataPayload {
  const checklists: Record<string, unknown> = {};
  for (let i = 0; i < storage.length; i += 1) {
    const k = storage.key(i);
    if (k !== null && k.startsWith('aether-checklist:') && k.endsWith(':v1')) {
      checklists[k] = safeRead(storage, k);
    }
  }
  return {
    version: 1,
    exportedAt: now.toISOString(),
    source: 'aether-account',
    recentPrompts: safeRead(storage, 'aether-pulse-recent:v1'),
    pulseHistory: safeRead(storage, 'aether-pulse-history:v1'),
    checklists,
    onboarded: storage.getItem('aether-onboarded') !== null,
    audioOptOut: storage.getItem('aether-audio-opt-out') === '1',
  };
}

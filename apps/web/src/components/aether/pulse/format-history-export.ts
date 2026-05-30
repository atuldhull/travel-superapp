/**
 * AE252 — pure formatter for the AE140 Pulse-history .json backup.
 *
 * The download surface wraps the persisted history in a versioned
 * envelope. Today the wrap is inlined. This helper canonicalises
 * the envelope shape so a future format-version bump lands here
 * and not in three download sites.
 */

import type { ChatMessage } from './persisted-pulse';

export interface PulseHistoryExport {
  readonly schema: 'aether.pulse.history';
  readonly version: number;
  readonly exportedAt: string;
  readonly count: number;
  readonly messages: ReadonlyArray<ChatMessage>;
}

export const PULSE_HISTORY_EXPORT_VERSION = 1;
export const PULSE_HISTORY_EXPORT_SCHEMA = 'aether.pulse.history' as const;

export function buildPulseHistoryExport(
  messages: ReadonlyArray<ChatMessage>,
  now: Date = new Date(),
): PulseHistoryExport {
  return {
    schema: PULSE_HISTORY_EXPORT_SCHEMA,
    version: PULSE_HISTORY_EXPORT_VERSION,
    exportedAt: now.toISOString(),
    count: messages.length,
    messages: messages.slice(),
  };
}

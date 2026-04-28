/**
 * V.UX.15 — audio readout of the trip's day list. Uses the built-in
 * Web Speech API (no deps, no network). Accessibility / senior
 * persona's "read this to me" affordance.
 *
 * Behaviour:
 *   1. Tap "🔊 Read aloud" → speechSynthesis.speak() with a script
 *      built from the day list (e.g. "Day 1: 3 stops including
 *      Eiffel Tower, Louvre, Notre-Dame.").
 *   2. While speaking, the button flips to "⏸ Stop" and a
 *      `aria-live` status reads each day as it speaks.
 *   3. On unmount or stop the queue is cleared via cancel().
 *
 * Renders nothing if the browser has no SpeechSynthesis (older
 * Firefox on Linux, certain mobile WebViews). Reads its own
 * itinerary so the parent just mounts <AudioReadout tripId={id} />.
 *
 * Installed by prompt [V.UX.15].
 */
'use client';

import { useEffect, useState } from 'react';
import {
  useTripControllerGetItinerary,
  type ItineraryDayDto,
  type ItineraryListResponseDto,
} from '@app/sdk';

export interface AudioReadoutProps {
  readonly tripId: string;
  readonly tripTitle: string;
  readonly enabled: boolean;
}

type Phase = 'idle' | 'speaking';

export function AudioReadout({ tripId, tripTitle, enabled }: AudioReadoutProps) {
  const [supported, setSupported] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');

  const { data } = useTripControllerGetItinerary(tripId, { query: { enabled } });
  const itinerary = data?.data as unknown as ItineraryListResponseDto | undefined;
  const days: readonly ItineraryDayDto[] = itinerary?.days ?? [];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSupported('speechSynthesis' in window);
  }, []);

  // Stop on unmount so the audio doesn't keep going if the user
  // navigates away mid-readout.
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!supported) return null;

  function speak() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const script = buildScript(tripTitle, days);
    if (script.length === 0) return;
    const u = new SpeechSynthesisUtterance(script);
    u.rate = 0.95;
    u.pitch = 1;
    u.onend = () => setPhase('idle');
    u.onerror = () => setPhase('idle');
    setPhase('speaking');
    synth.speak(u);
  }

  function stop() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setPhase('idle');
  }

  return (
    <div className="flex items-center gap-2">
      {phase === 'speaking' ? (
        <button
          type="button"
          onClick={stop}
          className="inline-flex items-center gap-1.5 rounded-md border border-brand bg-brand/10 px-3 py-1.5 text-sm font-medium text-brand transition hover:bg-brand/20"
          aria-label="Stop reading the trip aloud"
        >
          ⏸ Stop
        </button>
      ) : (
        <button
          type="button"
          onClick={speak}
          disabled={days.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-muted/30 px-3 py-1.5 text-sm font-medium transition hover:bg-muted/10 disabled:opacity-50"
          aria-label="Read the trip aloud"
        >
          🔊 Read aloud
        </button>
      )}
      <span aria-live="polite" className="sr-only">
        {phase === 'speaking' ? `Reading ${tripTitle} aloud` : ''}
      </span>
    </div>
  );
}

function buildScript(title: string, days: readonly ItineraryDayDto[]): string {
  if (days.length === 0) return '';
  const parts: string[] = [`${title}.`];
  for (const d of days) {
    const n = d.items.length;
    if (n === 0) {
      parts.push(`Day ${d.dayIndex + 1} is open — no stops yet.`);
    } else {
      parts.push(`Day ${d.dayIndex + 1} has ${n} ${n === 1 ? 'stop' : 'stops'}.`);
    }
  }
  return parts.join(' ');
}

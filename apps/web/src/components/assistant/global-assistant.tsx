/**
 * GlobalAssistant — the app-wide AI chatbot (Phase 2, D2).
 *
 * A calm floating panel — stacked above the SOS FAB on the right
 * (bottom-left is the translate widget's) — available on every page.
 * It plans and *refines* itineraries by
 * talking: name a place → it geocodes ($0 OSM) → asks the existing
 * public `/trips/sample-plan` endpoint (the same $0 Gemini→Ollama→stub
 * chain the landing demo uses) → every follow-up message threads
 * `instruction` + `priorPlan` so "make it cheaper / 2 more days /
 * more adventure" rewrites the plan.
 *
 * Honest scope (shown in the UI): it plans and refines — it does not
 * book, pay, or change your saved trips. No auth, no new deps, never
 * breaks (all failures degrade to a calm message).
 *
 * Installed for Phase 2 — Homepage hub (global assistant).
 */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { BookmarkPlus, MessageCircle, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { apiFetch, type GenerateSamplePlanResponseDto } from '@app/sdk';
import { searchPlaces } from '../../lib/geocode';
import { useAuthToken } from '../../lib/use-auth-token';

interface Msg {
  readonly role: 'you' | 'ai';
  readonly text: string;
}
type Phase = 'ask-place' | 'planning' | 'chat';

interface AssistantCtx {
  readonly title: string;
  readonly center: { readonly lat: number; readonly lng: number };
  readonly plan: string;
}

const RADIUS_KM = 20;
const QUICK = ['2 more days', 'Make it cheaper', 'More adventure', 'Slower pace'];
const WELCOME_MSG: Msg = {
  role: 'ai',
  text: "Hi — I'm your travel planner. Where would you like to go?",
};

// F6 — persist chat across reloads.
// F10 — versioned + per-trip-keyed so switching trips doesn't blow
// away the previous conversation. v1 key is intentionally orphaned
// (chat was a few days old; users lose one conversation, not data).
const STORAGE_PREFIX = 'travel:global-assistant:v2:';
const MAX_PERSIST_MSGS = 50;

function storageKey(tripId: string | null): string {
  return STORAGE_PREFIX + (tripId ?? 'general');
}

interface PersistedAssistantState {
  readonly v: 2;
  readonly msgs: readonly Msg[];
  readonly phase: Phase;
  readonly ctx: AssistantCtx | null;
  readonly tripId: string | null;
}

function isMsg(v: unknown): v is Msg {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (o.role === 'you' || o.role === 'ai') && typeof o.text === 'string';
}

function isCtx(v: unknown): v is AssistantCtx {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.title !== 'string' || typeof o.plan !== 'string') return false;
  const c = o.center;
  if (typeof c !== 'object' || c === null) return false;
  const cc = c as Record<string, unknown>;
  return (
    typeof cc.lat === 'number' &&
    Number.isFinite(cc.lat) &&
    typeof cc.lng === 'number' &&
    Number.isFinite(cc.lng)
  );
}

function loadSnapshot(tripId: string | null): PersistedAssistantState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(tripId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.v !== 2 || !Array.isArray(parsed.msgs)) return null;
    const msgs = parsed.msgs.filter(isMsg);
    const phase: Phase =
      parsed.phase === 'planning' || parsed.phase === 'chat' ? parsed.phase : 'ask-place';
    const ctx: AssistantCtx | null = isCtx(parsed.ctx) ? parsed.ctx : null;
    const storedTripId = typeof parsed.tripId === 'string' ? parsed.tripId : null;
    return { v: 2, msgs, phase, ctx, tripId: storedTripId };
  } catch {
    return null;
  }
}

function saveSnapshot(state: PersistedAssistantState): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed: PersistedAssistantState = {
      ...state,
      msgs: state.msgs.slice(-MAX_PERSIST_MSGS),
    };
    window.localStorage.setItem(storageKey(state.tripId), JSON.stringify(trimmed));
  } catch {
    // quota, privacy mode, etc. — silently no-op so the chat keeps
    // working in-memory.
  }
}

function clearSnapshot(tripId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(tripId));
  } catch {
    // no-op
  }
}

// D5 — imperative entry-point for the homepage hub (and any other
// surface that already knows the trip context). Calling this opens
// the panel pre-seeded with {title, center} and skips the ask-place
// stage. Module-level so callers don't need refs or context.
//
// F10 — optional `tripId` slots the chat under a per-trip localStorage
// key, so switching trips no longer clobbers a previous conversation.
//
// Returns true if the assistant is mounted and accepted the call;
// false if no instance is currently mounted (e.g. layout not ready).
type OpenWithArgs = {
  title: string;
  center: { lat: number; lng: number };
  tripId?: string;
};
let activeOpener: ((args: OpenWithArgs) => void) | null = null;

export function openAssistantWith(args: OpenWithArgs): boolean {
  if (!activeOpener) return false;
  activeOpener(args);
  return true;
}

export function GlobalAssistant() {
  const reduce = useReducedMotion();
  const router = useRouter();
  const authToken = useAuthToken();
  // F6 — lazy init from localStorage so a refresh doesn't lose the
  // conversation. F10 — boot from the 'general' slot by default; the
  // opener swaps to a per-trip slot when fired with a tripId.
  const initial = useMemo(() => loadSnapshot(null), []);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>(initial?.phase ?? 'ask-place');
  const [msgs, setMsgs] = useState<readonly Msg[]>(initial?.msgs ?? [WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeTripId, setActiveTripId] = useState<string | null>(initial?.tripId ?? null);
  const ctxRef = useRef<AssistantCtx | null>(initial?.ctx ?? null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, busy]);

  // F6 — persist on every transition. F10 — keyed by activeTripId so
  // each trip's conversation lives in its own localStorage slot.
  useEffect(() => {
    saveSnapshot({ v: 2, msgs, phase, ctx: ctxRef.current, tripId: activeTripId });
  }, [msgs, phase, activeTripId]);

  function say(role: Msg['role'], text: string) {
    setMsgs((m) => [...m, { role, text }]);
  }

  // F6 — reset to a fresh welcome state. F10 — only wipes the
  // currently-active slot; conversations for OTHER trips persist.
  function resetChat() {
    clearSnapshot(activeTripId);
    ctxRef.current = null;
    setPhase('ask-place');
    setMsgs([WELCOME_MSG]);
    setInput('');
    setBusy(false);
  }

  // D5 — register the module-level opener while mounted. F10 — opener
  // now switches to the per-trip slot, restoring the conversation if
  // one exists, otherwise starting fresh with a new plan.
  useEffect(() => {
    activeOpener = ({ title, center, tripId }) => {
      const targetSlot: string | null = tripId ?? null;
      const existing = loadSnapshot(targetSlot);
      if (
        existing &&
        existing.ctx &&
        existing.ctx.title === title &&
        existing.phase === 'chat' &&
        existing.msgs.length > 0
      ) {
        // Same-trip resume — restore the saved conversation in place.
        setOpen(true);
        setActiveTripId(targetSlot);
        ctxRef.current = existing.ctx;
        setPhase('chat');
        setMsgs(existing.msgs);
        setBusy(false);
        return;
      }
      // Different trip OR title changed OR no saved state — start fresh.
      setOpen(true);
      setActiveTripId(targetSlot);
      setPhase('planning');
      ctxRef.current = { title, center, plan: '' };
      setMsgs([
        {
          role: 'ai',
          text: `Putting together a fresh plan for ${title} — what would you like to focus on?`,
        },
      ]);
      setBusy(true);
      void (async () => {
        try {
          const plan = await generate(title, center);
          ctxRef.current = { title, center, plan };
          setPhase('chat');
          say('ai', plan);
          say('ai', 'Want to tweak it? e.g. "2 more days", "cheaper", "more adventure".');
        } catch {
          say('ai', 'I hit a snag reaching the planner. Try again in a moment, or rephrase.');
          setPhase('ask-place');
        } finally {
          setBusy(false);
        }
      })();
    };
    return () => {
      activeOpener = null;
    };
    // generate/say are stable closures; intentionally only run once
    // for the lifetime of this component instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // F13 — track the provider + token usage of the most recent
  // response so we can surface a calm "powered by …" badge.
  const [meta, setMeta] = useState<{
    provider: string;
    inputTokens?: number;
    outputTokens?: number;
  } | null>(null);

  async function generate(
    title: string,
    center: { lat: number; lng: number },
    instruction?: string,
  ) {
    const res = await apiFetch<{
      data: GenerateSamplePlanResponseDto;
      status: number;
      headers: Headers;
    }>('/api/v1/trips/sample-plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title,
        center,
        radiusKm: RADIUS_KM,
        ...(instruction ? { instruction, priorPlan: ctxRef.current?.plan ?? '' } : {}),
      }),
    });
    const d = res.data;
    const p: unknown = d?.plan;
    if (d?.provider) {
      setMeta({
        provider: d.provider,
        ...(d.tokenUsage?.inputTokens !== undefined
          ? { inputTokens: d.tokenUsage.inputTokens }
          : {}),
        ...(d.tokenUsage?.outputTokens !== undefined
          ? { outputTokens: d.tokenUsage.outputTokens }
          : {}),
      });
    }
    return typeof p === 'string' ? p : '';
  }

  // F13 — friendly display for the provider id ("anthropic", "gemini",
  // "ollama", "stub" → human label).
  const providerLabel = (p: string): string => {
    if (p === 'anthropic') return 'Claude';
    if (p === 'gemini') return 'Gemini';
    if (p === 'ollama') return 'Ollama (local)';
    if (p === 'stub') return 'Demo mode';
    return p;
  };

  // F11 — turn the chat's title+center into a real saved trip.
  // Honest: the prose plan in the chat doesn't transfer (no schema
  // column for it); we create a draft trip the user can immediately
  // re-plan or edit. Auth-gated by the API; unauthenticated callers
  // see a "Sign in to save" prompt instead of the button.
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  async function saveAsTrip() {
    if (!ctxRef.current || saving) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const res = await apiFetch<{
        data: { id?: string };
        status: number;
        headers: Headers;
      }>('/api/v1/trips', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: ctxRef.current.title,
          center: { lng: ctxRef.current.center.lng, lat: ctxRef.current.center.lat },
          radiusKm: RADIUS_KM,
        }),
      });
      const id = res.data?.id;
      if (typeof id === 'string' && id.length > 0) {
        say('ai', `Saved as a draft trip — opening it now. You can re-plan or edit dates there.`);
        setOpen(false);
        router.push(`/trips/${id}` as never);
      } else {
        setSaveErr('Saved but the response was unexpected — check your trips list.');
      }
    } catch {
      setSaveErr('Could not save. If you’re not signed in, sign in first and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function onSend() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    say('you', text);
    setBusy(true);
    try {
      if (phase === 'ask-place' || !ctxRef.current) {
        setPhase('planning');
        const hits = await searchPlaces(text, 1);
        const place = hits[0];
        if (!place) {
          say('ai', "I couldn't find that place — try a city or a more specific spot.");
          setPhase('ask-place');
          return;
        }
        const title = place.label.split(',')[0]?.trim() || text;
        const center = { lat: place.lat, lng: place.lng };
        say('ai', `Planning a few days around ${title}…`);
        const plan = await generate(title, center);
        ctxRef.current = { title, center, plan };
        setPhase('chat');
        say('ai', plan);
        say('ai', 'Want to tweak it? e.g. "2 more days", "cheaper", "more adventure".');
      } else {
        const { title, center } = ctxRef.current;
        const plan = await generate(title, center, text);
        ctxRef.current = { title, center, plan };
        say('ai', plan);
      }
    } catch {
      say('ai', 'I hit a snag reaching the planner. Try again in a moment, or rephrase.');
      if (phase === 'planning') setPhase('ask-place');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open travel assistant"
          className="fixed bottom-24 right-4 z-50 inline-flex items-center gap-2 rounded-full border border-gold-500/40 px-4 py-2.5 text-sm font-semibold text-brand-900 shadow-(--shadow-depth-2) transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          style={{ backgroundImage: 'var(--gradient-gold)' }}
        >
          <Sparkles aria-hidden className="h-4 w-4" /> Plan with AI
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed bottom-24 right-4 z-50 flex h-128 max-h-[80vh] w-88 max-w-[88vw] flex-col overflow-hidden rounded-2xl border border-gold-600/25 bg-surface shadow-(--shadow-depth-3)"
            role="dialog"
            aria-label="Travel assistant"
          >
            <header
              className="flex items-center justify-between px-4 py-3 text-white"
              style={{ backgroundImage: 'var(--gradient-royal)' }}
            >
              <span className="inline-flex items-center gap-2 text-sm font-semibold">
                <MessageCircle aria-hidden className="h-4 w-4 text-gold-300" /> Travel assistant
              </span>
              <div className="flex items-center gap-1">
                {msgs.length > 1 || phase !== 'ask-place' ? (
                  <button
                    type="button"
                    onClick={resetChat}
                    aria-label="Start a new chat"
                    title="Start a new chat"
                    className="rounded-full p-1 text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <RotateCcw aria-hidden className="h-4 w-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close assistant"
                  className="rounded-full p-1 text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <X aria-hidden className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {msgs.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === 'you'
                      ? 'ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-gold-500/15 px-3 py-2 text-sm text-surface-foreground'
                      : 'mr-auto max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-gold-600/15 bg-surface px-3 py-2 text-sm text-surface-foreground shadow-(--shadow-depth-1)'
                  }
                >
                  {m.text}
                </div>
              ))}
              {busy ? (
                <p className="mr-auto inline-flex items-center gap-1.5 rounded-2xl border border-gold-600/15 px-3 py-2 text-sm text-muted">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-500" />
                  Thinking…
                </p>
              ) : null}
            </div>

            {phase === 'chat' && !busy ? (
              <div className="flex flex-wrap gap-1.5 px-3 pb-1">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setInput(q);
                    }}
                    className="rounded-full border border-gold-600/20 px-2.5 py-1 text-xs text-muted transition hover:border-gold-600/40 hover:text-surface-foreground"
                  >
                    {q}
                  </button>
                ))}
              </div>
            ) : null}

            {/* F11 — save the current title+center as a real trip. Only
                shows in 'chat' phase (after a plan exists) and only
                for signed-in users; the API would 401 otherwise. */}
            {phase === 'chat' && !busy && ctxRef.current && !activeTripId ? (
              <div className="flex flex-col gap-1 px-3 pb-2">
                {authToken !== null ? (
                  <button
                    type="button"
                    onClick={saveAsTrip}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gold-600/30 bg-gold-500/8 px-3 py-1.5 text-xs font-semibold text-gold-700 transition hover:bg-gold-500/15 disabled:opacity-50 dark:text-gold-200"
                  >
                    <BookmarkPlus aria-hidden className="h-3.5 w-3.5" />
                    {saving ? 'Saving…' : 'Save as a new trip'}
                  </button>
                ) : (
                  <p className="text-center text-[11px] text-muted">
                    Sign in to save this as a trip.
                  </p>
                )}
                {saveErr ? <p className="text-center text-[11px] text-danger">{saveErr}</p> : null}
              </div>
            ) : null}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void onSend();
              }}
              className="flex items-center gap-2 border-t border-gold-600/15 p-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={phase === 'ask-place' ? 'e.g. Lisbon, Portugal' : 'Ask to tweak it…'}
                className="min-w-0 flex-1 rounded-xl border border-gold-600/20 bg-surface px-3 py-2 text-sm text-surface-foreground outline-none transition placeholder:text-muted/70 focus-visible:border-gold-600/50 focus-visible:ring-2 focus-visible:ring-accent"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Send"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-brand-900 shadow-(--shadow-depth-1) transition hover:opacity-90 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                style={{ backgroundImage: 'var(--gradient-gold)' }}
              >
                <Send aria-hidden className="h-4 w-4" />
              </button>
            </form>
            <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-3 pb-2 text-center text-[10px] text-muted">
              <span>Plans &amp; refines — it doesn&apos;t book or change saved trips.</span>
              {meta ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-gold-600/20 bg-gold-500/8 px-1.5 py-0.5 text-gold-700 dark:text-gold-300"
                  title={
                    meta.inputTokens !== undefined && meta.outputTokens !== undefined
                      ? `Tokens: ${meta.inputTokens} in / ${meta.outputTokens} out`
                      : undefined
                  }
                >
                  Powered by {providerLabel(meta.provider)}
                  {meta.outputTokens !== undefined ? (
                    <span className="text-muted/80">· {meta.outputTokens} out</span>
                  ) : null}
                </span>
              ) : null}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

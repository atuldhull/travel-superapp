'use client';

/**
 * <Pulse> — always-present AI overlay on every Aether surface.
 *
 * A small terracotta FAB sits bottom-right. Click expands it into a
 * glass-cream drawer with a real conversational surface — typing a
 * place / mood / question fires the existing public `/trips/sample-plan`
 * endpoint (the same $0 Gemini→Ollama→stub chain the landing demo
 * uses). Follow-ups thread `instruction` + `priorPlan` so the model
 * refines instead of restarting ("make it cheaper" / "two more days"
 * / "more adventure").
 *
 * Honest scope (matches GlobalAssistant): Pulse plans + refines. It
 * does not book, pay, or change saved trips. All failures degrade
 * to a calm message. No auth required.
 *
 * Hidden on `/aether/plan` itself (the planner IS the AI surface
 * there). Mounted by every Aether *-shell inside the AetherProvider.
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMotionPolicy, useTheme } from '@app/aether-core';
import {
  tripControllerSamplePlan,
  useTripControllerCreate,
  useTripControllerShare,
  type GenerateSamplePlanResponseDto,
  type TripDto,
  type TripShareResponseDto,
} from '@app/sdk';
import { geocodeOne } from '../../../lib/geocode';
import { useAuthBootComplete, useAuthToken } from '../../../lib/use-auth-token';
import { useViewport } from '../use-viewport';
import { useVoiceInput } from './use-voice-input';

const QUICK_PROMPTS = [
  { label: 'Plan a trip', kind: 'plan' as const, href: '/aether/plan' },
  { label: 'Your journeys', kind: 'mine' as const, href: '/aether/me/journeys' },
  { label: 'Find a destination', kind: 'find' as const, href: '/aether/destinations' },
  { label: 'See the map', kind: 'map' as const, href: '/aether/atlas' },
];

/** AE132 — three evergreen seed prompts for first-time users (when
 *  Recent has fewer than 3 entries). Mixed: one introspective, one
 *  practical, one curious — so a user finds at least one they want
 *  to tap. Phrased as a user would, so they survive being run as-is
 *  through Pulse's planner. */
const SUGGESTED_PROMPTS: ReadonlyArray<string> = [
  'A slow five days somewhere in season near me.',
  'Plan two weekends back-to-back — one for ruins, one for the coast.',
  'Where should I go that nobody Instagram-knows yet?',
];

// AE85 slash-command palette — the data + matcher live in
// ./slash-commands.ts so they can be unit-tested without spinning
// up the Pulse drawer (AE91).
import { SLASH_COMMANDS, matchSlashCommands } from './slash-commands';
// AE163 — pure bridge-event decoder, extracted for testability.
import { decodePulseOpenEvent } from './bridge-event';

// AE72 + AE184 — types + storage key + parser extracted to
// ./persisted-pulse.ts so the shape contract is unit-testable.
import {
  PULSE_STORAGE_KEY,
  parsePulseStore,
  type ChatMessage,
  type PersistedPulse,
} from './persisted-pulse';

const DEFAULT_CENTER = { lat: 26.9124, lng: 75.7873 } as const; // Jaipur fallback.

const PULSE_MAX_MESSAGES = 40;

// AE106 helpers moved to ./recent-prompts.ts in AE109 so they can
// be unit-tested without spinning up the Pulse drawer.
import { appendRecentPrompt, readRecentPrompts } from './recent-prompts';

// AE184 — readPulseStore now defers all parsing to parsePulseStore so
// the validation rules can be exercised without a DOM stub.
function readPulseStore(): PersistedPulse | null {
  if (typeof window === 'undefined') return null;
  return parsePulseStore(window.localStorage.getItem(PULSE_STORAGE_KEY));
}

export function Pulse(): React.ReactElement | null {
  const theme = useTheme();
  const motionPolicy = useMotionPolicy();
  const { isNarrow } = useViewport();
  const pathname = usePathname();
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const isAuthed = bootComplete && token !== null;
  const [open, setOpen] = useState<boolean>(false);
  const [q, setQ] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<boolean>(false);
  // AE159 — rotate through 3 micro-copy phrases while pending so a
  // long wait shows the assistant is still working, not stuck.
  const [pendingPhraseIdx, setPendingPhraseIdx] = useState<number>(0);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // When save+share is chosen, hold the intent across the create
  // mutation so onSuccess can chain into the share mutation.
  const [shareAfterSave, setShareAfterSave] = useState<boolean>(false);
  const [savedShareConfirm, setSavedShareConfirm] = useState<boolean>(false);
  // AE106 — long-memory recent user prompts, separate from messages.
  const [recent, setRecent] = useState<string[]>([]);

  const shareTrip = useTripControllerShare({
    mutation: {
      onSuccess: (created: TripShareResponseDto, vars: { id: string }) => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const shareUrl = `${origin}/shared/${created.shareCode}`;
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          void navigator.clipboard.writeText(shareUrl);
        }
        setSavedShareConfirm(true);
        // Drop the confirmation after a beat, then open the journey.
        window.setTimeout(() => {
          setSavedShareConfirm(false);
          setOpen(false);
          setSaving(false);
          setShareAfterSave(false);
          router.push(`/aether/journey/${vars.id}`);
        }, 900);
      },
      onError: (err: unknown) => {
        // Trip exists; share failed. Still navigate so the user can
        // mint the link from the dashboard.
        setSaveError(err instanceof Error ? err.message : 'Saved, but the share link failed.');
        setShareAfterSave(false);
      },
    },
  });

  const createTrip = useTripControllerCreate({
    mutation: {
      onSuccess: (created: TripDto) => {
        if (shareAfterSave) {
          shareTrip.mutate({ id: created.id, data: {} });
          return;
        }
        setOpen(false);
        setSaving(false);
        router.push(`/aether/journey/${created.id}`);
      },
      onError: (err: unknown) => {
        setSaving(false);
        setShareAfterSave(false);
        setSaveError(err instanceof Error ? err.message : 'Could not save. Try again.');
      },
    },
  });
  const [provider, setProvider] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Threaded refinement context — sent to follow-up samplePlan calls so
  // the model edits the prior plan instead of writing a new one.
  // AE72 — promoted from useRef to useState so the persistence effect
  // can listen to changes.
  interface PulseCtx {
    readonly title: string;
    readonly center: { readonly lat: number; readonly lng: number };
    readonly plan: string;
  }
  const [ctx, setCtx] = useState<PulseCtx | null>(null);

  const hidden = pathname === '/aether/plan';

  // AE72 — restore prior conversation + ctx + provider on mount. We
  // do it once (no deps); subsequent changes flow the other direction
  // through the persistence effect below.
  useEffect(() => {
    const stored = readPulseStore();
    if (stored !== null) {
      if (stored.messages.length > 0) setMessages(stored.messages);
      if (stored.ctx !== null) setCtx(stored.ctx);
      if (stored.provider !== null) setProvider(stored.provider);
    }
    // AE106 — load the long-memory recent list (survives Reset).
    setRecent(readRecentPrompts());
  }, []);

  // AE159 — phrase rotation while `pending` is true. Resets to 0 when
  // pending flips off. Three phrases @ 1.5s interval; clamps at the
  // last one so the wait reads "Almost there…" indefinitely.
  useEffect(() => {
    if (!pending) {
      setPendingPhraseIdx(0);
      return;
    }
    setPendingPhraseIdx(0);
    const id = window.setInterval(() => {
      setPendingPhraseIdx((i) => (i < 2 ? i + 1 : 2));
    }, 1500);
    return () => window.clearInterval(id);
  }, [pending]);

  // AE96 + AE146 — listen for `aether-pulse-open` events. The detail
  // decoder lives in ./bridge-event.ts so it can be unit-tested
  // without spinning up the drawer (AE163).
  useEffect(() => {
    if (hidden) return;
    const onOpen = (e: Event): void => {
      const { prefill, shouldSubmit } = decodePulseOpenEvent((e as CustomEvent<unknown>).detail);
      setOpen(true);
      if (prefill !== '') {
        setQ(prefill);
        window.setTimeout(() => inputRef.current?.focus(), 50);
        if (shouldSubmit) {
          // Fire after the open animation so the user sees the prompt
          // land, then the assistant bubble appears.
          window.setTimeout(() => {
            void ask(prefill);
            setQ('');
          }, 220);
        }
      }
    };
    window.addEventListener('aether-pulse-open', onOpen);
    return () => window.removeEventListener('aether-pulse-open', onOpen);
  }, [hidden]);

  // AE72 — persist on every change. Caps messages at PULSE_MAX_MESSAGES
  // from the end so the localStorage entry never grows unbounded.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload: PersistedPulse = {
      messages: messages.slice(-PULSE_MAX_MESSAGES),
      ctx,
      provider,
    };
    try {
      // Skip write when there's nothing to remember — avoids stamping
      // an empty entry over a useful one when the tab boots before
      // restore lands.
      if (payload.messages.length === 0 && payload.ctx === null && payload.provider === null) {
        return;
      }
      window.localStorage.setItem(PULSE_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* quota / private mode — silently degrade */
    }
  }, [messages, ctx, provider]);

  // Voice input — streams interim text into the field, commits final
  // transcript on stop. The mic button hides if the browser doesn't
  // ship SpeechRecognition (Firefox, older Safari).
  const voice = useVoiceInput({
    onInterim: (text) => setQ(text),
    onFinal: (text) => setQ(text.trim()),
  });

  useEffect(() => {
    if (open && inputRef.current !== null) {
      const id = window.setTimeout(
        () => inputRef.current?.focus(),
        motionPolicy === 'full' ? 200 : 0,
      );
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open, motionPolicy]);

  useEffect(() => {
    if (scrollRef.current !== null) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pending]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  // Global keyboard shortcut to OPEN Pulse: Cmd/Ctrl+K or `/`
  // (matches the conventions Linear/Vercel/GitHub trained users on).
  // Skips when the user is typing into another input — `/` is a normal
  // character then. Ignored on the planner page (Pulse is hidden).
  useEffect(() => {
    if (hidden) return;
    const onKey = (e: KeyboardEvent): void => {
      const isCmdK = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K');
      const isSlash = e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey;
      if (!isCmdK && !isSlash) return;
      // Ignore when focus is in any other text input / textarea / select
      // / contenteditable element — `/` is a normal keystroke there.
      const target = e.target as HTMLElement | null;
      if (target !== null) {
        const tag = target.tagName;
        const editable = target.isContentEditable === true;
        if (editable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
          return;
        }
      }
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hidden]);

  if (hidden) return null;

  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;
  const ochre = theme.palette.ochre;
  const olive = theme.palette.olive;

  /** Generate or refine via the public sample-plan endpoint. */
  async function ask(userText: string): Promise<void> {
    const trimmed = userText.trim();
    if (trimmed === '') return;

    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setQ('');
    setPending(true);
    // AE106 — long-memory recent list (survives Reset).
    appendRecentPrompt(trimmed);
    setRecent(readRecentPrompts());

    try {
      let title: string;
      let center: { lat: number; lng: number };
      const isFollowUp = ctx !== null;

      if (isFollowUp) {
        title = ctx.title;
        center = { lat: ctx.center.lat, lng: ctx.center.lng };
      } else {
        const hit = await geocodeOne(trimmed, 'India', DEFAULT_CENTER);
        title = hit?.label ?? trimmed;
        center = hit ? { lat: hit.lat, lng: hit.lng } : DEFAULT_CENTER;
      }

      const requestBody = isFollowUp
        ? {
            title,
            center,
            radiusKm: 50,
            instruction: trimmed,
            priorPlan: ctx?.plan ?? '',
          }
        : { title, center, radiusKm: 50 };

      const res = (await tripControllerSamplePlan(
        requestBody as unknown as Parameters<typeof tripControllerSamplePlan>[0],
      )) as unknown as { data: GenerateSamplePlanResponseDto };
      const d = res.data;
      const planValue: unknown = d?.plan;
      const plan = typeof planValue === 'string' ? planValue : '';

      if (plan === '') {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              "Couldn't sketch this one. Try a more specific place, or open the full planner via Plan a trip below.",
          },
        ]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: plan }]);
        setCtx({ title, center: { lat: center.lat, lng: center.lng }, plan });
        if (d?.provider) setProvider(d.provider);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'The intelligence is unreachable right now. The planner page still works — Plan a trip below.',
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    void ask(q);
  };

  const handleReset = (): void => {
    setMessages([]);
    setProvider(null);
    setCtx(null);
    // AE72 — clear persistence too so a fresh tab starts empty.
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(PULSE_STORAGE_KEY);
      } catch {
        /* ignore quota / private mode */
      }
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        bottom: isNarrow ? theme.space.comfy : theme.space.gutter,
        right: isNarrow ? theme.space.comfy : theme.space.gutter,
        zIndex: theme.layer.pulse,
        fontFamily: theme.font.ui,
      }}
    >
      {open && (
        <div
          role="dialog"
          aria-label="Aether assistant"
          style={{
            position: 'absolute',
            right: 0,
            bottom: 64,
            width: isNarrow ? 'calc(100vw - 32px)' : 'min(420px, calc(100vw - 32px))',
            maxHeight: 'min(620px, calc(100vh - 120px))',
            display: 'flex',
            flexDirection: 'column',
            padding: theme.space.comfy,
            borderRadius: theme.radius.lg,
            background: 'rgba(242, 232, 213, 0.96)',
            backdropFilter: 'blur(16px) saturate(160%)',
            WebkitBackdropFilter: 'blur(16px) saturate(160%)',
            border: `1px solid ${ink.whisper}`,
            boxShadow: '0 24px 64px rgba(24, 15, 11, 0.28), 0 4px 12px rgba(24, 15, 11, 0.12)',
            color: ink.base,
            transformOrigin: 'bottom right',
            animation:
              motionPolicy === 'full'
                ? 'aether-pulse-open 280ms cubic-bezier(0.16, 0.84, 0.32, 1)'
                : 'none',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: theme.space.tight,
              borderBottom: `1px solid ${olive.whisper}`,
              marginBottom: theme.space.tight,
            }}
          >
            <span
              style={{
                fontFamily: theme.font.ui,
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: accent.deep,
                fontWeight: 600,
              }}
            >
              Pulse · ask anything
              {!isNarrow && (
                <span
                  style={{
                    fontFamily: theme.font.mono,
                    letterSpacing: '0.06em',
                    color: ink.soft,
                    opacity: 0.55,
                    marginLeft: 6,
                    fontWeight: 400,
                  }}
                >
                  ⌘K · /
                </span>
              )}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleReset}
                  aria-label="Start over"
                  style={{
                    fontFamily: theme.font.ui,
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    background: 'transparent',
                    border: 'none',
                    color: ink.soft,
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: theme.radius.sm,
                    fontWeight: 600,
                  }}
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
                style={{
                  width: 24,
                  height: 24,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: theme.radius.pill,
                  background: 'transparent',
                  border: 'none',
                  color: ink.soft,
                  fontSize: 16,
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Conversation scroll area */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: `${theme.space.tight}px 2px`,
              display: 'flex',
              flexDirection: 'column',
              gap: theme.space.tight,
              minHeight: 0,
            }}
          >
            {messages.length === 0 && !pending && (
              <>
                <p
                  style={{
                    fontFamily: theme.font.display,
                    fontSize: 17,
                    lineHeight: 1.45,
                    letterSpacing: '-0.008em',
                    color: ink.base,
                    margin: 0,
                    marginBottom: theme.space.tight,
                  }}
                >
                  How can the journey help today?
                </p>

                {/* AE106 — Recent prompts (long-memory, survives Reset) */}
                {recent.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      marginBottom: theme.space.comfy,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: theme.font.ui,
                        fontSize: 10,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: ochre.deep,
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      Recent
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {recent.slice(0, 3).map((r) => (
                        <button
                          type="button"
                          key={r}
                          onClick={() => {
                            setQ(r);
                            inputRef.current?.focus();
                          }}
                          style={{
                            textAlign: 'left',
                            padding: `${theme.space.hairline}px ${theme.space.inline}px`,
                            borderRadius: theme.radius.sm,
                            background: 'transparent',
                            border: `1px solid ${ochre.whisper}`,
                            color: ink.base,
                            fontFamily: theme.font.display,
                            fontStyle: 'italic',
                            fontSize: 13,
                            lineHeight: 1.4,
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={r}
                          aria-label={`Reuse recent prompt: ${r}`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* AE132 — 3 curated seed prompts so a first-time user
                    has something to tap. Hidden when Recent already
                    surfaces 3+ prompts (no point duplicating). */}
                {recent.length < 3 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      marginBottom: theme.space.comfy,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: theme.font.ui,
                        fontSize: 10,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: olive.deep,
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      Try one of these
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {SUGGESTED_PROMPTS.map((p) => (
                        <button
                          type="button"
                          key={p}
                          onClick={() => {
                            setQ(p);
                            inputRef.current?.focus();
                          }}
                          style={{
                            textAlign: 'left',
                            padding: `${theme.space.hairline}px ${theme.space.inline}px`,
                            borderRadius: theme.radius.sm,
                            background: 'transparent',
                            border: `1px solid ${olive.whisper}`,
                            color: ink.base,
                            fontFamily: theme.font.display,
                            fontStyle: 'italic',
                            fontSize: 13,
                            lineHeight: 1.4,
                            cursor: 'pointer',
                          }}
                          aria-label={`Use suggested prompt: ${p}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span
                    style={{
                      fontFamily: theme.font.ui,
                      fontSize: 10,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: ink.soft,
                      opacity: 0.7,
                      marginBottom: 4,
                    }}
                  >
                    Or quick paths
                  </span>
                  {QUICK_PROMPTS.map((p) => (
                    <Link
                      key={p.kind}
                      href={p.href}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: `${theme.space.tight}px ${theme.space.inline}px`,
                        borderRadius: theme.radius.md,
                        background: 'transparent',
                        textDecoration: 'none',
                        color: ink.base,
                        fontFamily: theme.font.ui,
                        fontSize: theme.text.body.size,
                        border: `1px solid transparent`,
                        transition: 'background 220ms, border-color 220ms',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = olive.whisper;
                        e.currentTarget.style.borderColor = olive.whisper;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = 'transparent';
                      }}
                      onClick={() => setOpen(false)}
                    >
                      <span>{p.label}</span>
                      <span aria-hidden style={{ color: accent.deep, fontWeight: 600 }}>
                        →
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}

            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '88%',
                  padding: `${theme.space.tight}px ${theme.space.inline}px`,
                  borderRadius: theme.radius.lg,
                  background: m.role === 'user' ? accent.base : surface.base,
                  color: m.role === 'user' ? surface.base : ink.base,
                  fontFamily: m.role === 'user' ? theme.font.ui : theme.font.display,
                  fontSize: m.role === 'user' ? theme.text.small.size : 14,
                  lineHeight: m.role === 'user' ? 1.5 : 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  border: m.role === 'assistant' ? `1px solid ${ink.whisper}` : 'none',
                  boxShadow: m.role === 'user' ? '0 2px 8px rgba(194, 97, 74, 0.25)' : 'none',
                }}
              >
                {m.content}
              </div>
            ))}

            {pending && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  padding: `${theme.space.tight}px ${theme.space.inline}px`,
                  borderRadius: theme.radius.lg,
                  background: surface.base,
                  border: `1px solid ${ink.whisper}`,
                  fontFamily: theme.font.display,
                  fontStyle: 'italic',
                  fontSize: 14,
                  color: ink.soft,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    animation:
                      motionPolicy === 'full'
                        ? 'aether-pulse-dot 1.4s ease-in-out infinite'
                        : 'none',
                  }}
                >
                  {['Reading…', 'Sketching the route…', 'Almost there…'][pendingPhraseIdx]}
                </span>
              </div>
            )}
          </div>

          {/* AE85 — Slash command palette. Shown when the input starts
              with '/'. Filters by the suffix after the slash. */}
          {q.startsWith('/') &&
            (() => {
              const matches = matchSlashCommands(q, SLASH_COMMANDS).slice(0, 6);
              if (matches.length === 0) return null;
              return (
                <div
                  role="listbox"
                  aria-label="Slash command suggestions"
                  style={{
                    marginTop: theme.space.tight,
                    paddingTop: theme.space.tight,
                    borderTop: `1px solid ${olive.whisper}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  {matches.map((c) => (
                    <button
                      type="button"
                      key={c.cmd}
                      onClick={() => {
                        setQ(c.expand);
                        inputRef.current?.focus();
                      }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr auto',
                        alignItems: 'center',
                        gap: theme.space.tight,
                        padding: `6px 8px`,
                        borderRadius: theme.radius.sm,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                        fontFamily: theme.font.ui,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = olive.whisper;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <code
                        style={{
                          fontFamily: theme.font.mono,
                          fontSize: 11,
                          color: accent.deep,
                          fontWeight: 600,
                          letterSpacing: '0.04em',
                        }}
                      >
                        {c.cmd}
                      </code>
                      <span
                        style={{
                          fontFamily: theme.font.display,
                          fontStyle: 'italic',
                          fontSize: 13,
                          color: ink.base,
                          lineHeight: 1.3,
                        }}
                      >
                        {c.hint}
                      </span>
                      <span
                        aria-hidden
                        style={{
                          fontFamily: theme.font.ui,
                          fontSize: 10,
                          color: ink.soft,
                          opacity: 0.65,
                          letterSpacing: '0.1em',
                        }}
                      >
                        ↵
                      </span>
                    </button>
                  ))}
                </div>
              );
            })()}

          {/* Input bar */}
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              gap: theme.space.tight,
              marginTop: theme.space.tight,
              paddingTop: theme.space.tight,
              borderTop: `1px solid ${olive.whisper}`,
            }}
          >
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                voice.listening
                  ? 'Listening…'
                  : messages.length === 0
                    ? 'A place, a mood, a question…'
                    : 'Refine — fewer days, cheaper, more art…'
              }
              aria-label="Ask the assistant"
              disabled={pending}
              style={{
                flex: 1,
                padding: `${theme.space.tight}px ${theme.space.inline}px`,
                borderRadius: theme.radius.pill,
                border: `1px solid ${voice.listening ? accent.deep : ink.whisper}`,
                background: surface.base,
                color: ink.base,
                fontFamily: theme.font.ui,
                fontSize: theme.text.body.size,
                outline: 'none',
                opacity: pending ? 0.6 : 1,
                transition: 'border-color 220ms',
              }}
            />
            {voice.supported && (
              <button
                type="button"
                onClick={() => (voice.listening ? voice.stop() : voice.start())}
                aria-label={voice.listening ? 'Stop voice input' : 'Speak instead of typing'}
                aria-pressed={voice.listening}
                title={voice.error !== null ? `Voice: ${voice.error}` : undefined}
                style={{
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                  borderRadius: theme.radius.pill,
                  background: voice.listening ? accent.deep : 'transparent',
                  border: `1px solid ${voice.listening ? accent.deep : ink.whisper}`,
                  color: voice.listening ? surface.base : ink.soft,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 220ms, border-color 220ms, color 220ms',
                  animation:
                    voice.listening && motionPolicy === 'full'
                      ? 'aether-pulse-dot 1.6s ease-in-out infinite'
                      : 'none',
                }}
              >
                {voice.listening ? '●' : '◐'}
              </button>
            )}
            <button
              type="submit"
              aria-label="Ask"
              disabled={pending || q.trim() === ''}
              style={{
                width: 36,
                height: 36,
                flexShrink: 0,
                borderRadius: theme.radius.pill,
                background: pending || q.trim() === '' ? ink.whisper : accent.base,
                color: surface.base,
                border: 'none',
                fontSize: 16,
                cursor: pending || q.trim() === '' ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 220ms',
              }}
            >
              →
            </button>
          </form>

          {/* Provider chip */}
          <div
            style={{
              marginTop: 6,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontFamily: theme.font.mono,
              fontSize: 10,
              color: ink.soft,
              opacity: 0.55,
              letterSpacing: '0.12em',
            }}
          >
            <span>Pulse · plans + refines, never books</span>
            {provider !== null && <span>via {provider}</span>}
          </div>

          {messages.length > 0 && ctx !== null && (
            <>
              {saveError !== null && (
                <div
                  role="alert"
                  style={{
                    marginTop: theme.space.tight,
                    padding: `6px ${theme.space.inline}px`,
                    borderRadius: theme.radius.sm,
                    background: 'rgba(184, 58, 46, 0.10)',
                    color: '#8a2418',
                    fontFamily: theme.font.ui,
                    fontSize: 11,
                    lineHeight: 1.4,
                  }}
                >
                  {saveError}
                </div>
              )}
              {savedShareConfirm && (
                <div
                  role="status"
                  style={{
                    marginTop: theme.space.tight,
                    padding: `6px ${theme.space.inline}px`,
                    borderRadius: theme.radius.sm,
                    background: olive.whisper,
                    border: `1px solid ${olive.deep}`,
                    color: ink.base,
                    fontFamily: theme.font.ui,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                    lineHeight: 1.4,
                  }}
                >
                  ✓ Link copied · journey opening…
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setSaveError(null);
                  setShareAfterSave(false);
                  if (!isAuthed) {
                    setOpen(false);
                    router.push('/login?next=/aether/me/journeys');
                    return;
                  }
                  if (ctx === null) return;
                  setSaving(true);
                  createTrip.mutate({
                    data: {
                      title: ctx.title,
                      center: { lat: ctx.center.lat, lng: ctx.center.lng },
                      radiusKm: 50,
                    },
                  });
                }}
                disabled={saving || createTrip.isPending || shareTrip.isPending}
                style={{
                  marginTop: theme.space.tight,
                  padding: `${theme.space.tight}px ${theme.space.inline}px`,
                  borderRadius: theme.radius.md,
                  background: olive.whisper,
                  border: `1px solid ${olive.whisper}`,
                  color: ink.base,
                  fontFamily: theme.font.ui,
                  fontSize: theme.text.small.size,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor:
                    saving || createTrip.isPending || shareTrip.isPending ? 'wait' : 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  opacity: saving || createTrip.isPending || shareTrip.isPending ? 0.7 : 1,
                  transition: 'background 220ms',
                }}
              >
                <span>
                  {saving || createTrip.isPending
                    ? 'Saving the journey…'
                    : isAuthed
                      ? 'Save this as a real trip'
                      : 'Sign in & save'}
                </span>
                <span aria-hidden style={{ color: accent.deep }}>
                  →
                </span>
              </button>
              {isAuthed && (
                <button
                  type="button"
                  onClick={() => {
                    setSaveError(null);
                    if (ctx === null) return;
                    setShareAfterSave(true);
                    setSaving(true);
                    createTrip.mutate({
                      data: {
                        title: ctx.title,
                        center: { lat: ctx.center.lat, lng: ctx.center.lng },
                        radiusKm: 50,
                      },
                    });
                  }}
                  disabled={saving || createTrip.isPending || shareTrip.isPending}
                  style={{
                    marginTop: 6,
                    padding: `6px ${theme.space.inline}px`,
                    borderRadius: theme.radius.md,
                    background: 'transparent',
                    border: `1px solid ${ochre.deep}`,
                    color: ochre.deep,
                    fontFamily: theme.font.ui,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor:
                      saving || createTrip.isPending || shareTrip.isPending ? 'wait' : 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    opacity: saving || createTrip.isPending || shareTrip.isPending ? 0.7 : 1,
                  }}
                >
                  <span>
                    {shareTrip.isPending
                      ? 'Minting link…'
                      : shareAfterSave && (saving || createTrip.isPending)
                        ? 'Saving + minting…'
                        : 'Save + share immediately'}
                  </span>
                  <span aria-hidden style={{ color: ochre.deep }}>
                    ⧉
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* The FAB itself */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close assistant' : 'Open Aether assistant (Cmd+K or /)'}
        aria-expanded={open}
        title={open ? 'Close (Esc)' : 'Open (Cmd+K · /)'}
        style={{
          width: 56,
          height: 56,
          borderRadius: theme.radius.pill,
          background: accent.base,
          color: surface.base,
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(194, 97, 74, 0.45), 0 2px 6px rgba(24, 15, 11, 0.18)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.font.display,
          fontSize: 22,
          fontWeight: 600,
          transition: 'transform 240ms cubic-bezier(0.42, 0, 0.18, 1), box-shadow 240ms',
          position: 'relative',
        }}
        onMouseEnter={(e) => {
          if (motionPolicy === 'full') {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.04)';
            e.currentTarget.style.boxShadow =
              '0 12px 32px rgba(194, 97, 74, 0.55), 0 4px 10px rgba(24, 15, 11, 0.22)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.boxShadow =
            '0 8px 24px rgba(194, 97, 74, 0.45), 0 2px 6px rgba(24, 15, 11, 0.18)';
        }}
      >
        {open ? '×' : '✦'}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: ochre.glow,
            border: `2px solid ${surface.base}`,
            display: open ? 'none' : 'block',
            animation:
              motionPolicy === 'full' ? 'aether-pulse-dot 2.4s ease-in-out infinite' : 'none',
          }}
        />
      </button>

      <style>{`
        @keyframes aether-pulse-open {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes aether-pulse-dot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.4); opacity: 0.65; }
        }
      `}</style>
    </div>
  );
}

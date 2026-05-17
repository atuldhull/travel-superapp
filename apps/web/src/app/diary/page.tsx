/**
 * /diary — the premium Adventure Diary.
 *
 * A freeform AI-assisted travel journal with a points / streak /
 * badge HUD. Write, let the assistant prompt or polish, save, and
 * watch the gamification celebrate. Powered by /api/v1/diary/* via
 * lib/two-oh-api (apiFetch-direct seam). Auth-gated; luxe offline +
 * sign-in states mirror /featured + /navigate.
 *
 * Installed for the adventure-diary feature.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthBootComplete, useAuthToken } from '../../lib/use-auth-token';
import {
  assistDiary,
  createDiaryEntry,
  getGamification,
  listDiaryEntries,
  type BadgeView,
  type DiaryEntryDto,
  type GamificationView,
} from '../../lib/two-oh-api';
import { toast } from '../../components/ui/toast';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  BookText,
  CloudOff,
  Compass,
  Crown,
  Flame,
  Footprints,
  Gem,
  Library,
  Lock,
  NotebookPen,
  Sparkles,
  ShieldAlert,
  Trophy,
  Wand2,
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { SkeletonCard } from '../../components/ui/skeleton';

const BADGE_ICON: Record<string, typeof Trophy> = {
  Footprints,
  BookText,
  Library,
  Compass,
  Flame,
  Crown,
  Sparkles,
  Gem,
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function DiaryPage() {
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const reduce = useReducedMotion();

  const [entries, setEntries] = useState<readonly DiaryEntryDto[]>([]);
  const [game, setGame] = useState<GamificationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | 'offline' | 'auth'>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mood, setMood] = useState('');
  const [place, setPlace] = useState('');
  const [aiAssisted, setAiAssisted] = useState(false);
  const [busy, setBusy] = useState<null | 'save' | 'prompt' | 'polish' | 'title'>(null);
  const [prompts, setPrompts] = useState<readonly string[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [g, e] = await Promise.all([getGamification(), listDiaryEntries({ limit: 50 })]);
      setGame(g);
      setEntries(e.entries);
    } catch (err) {
      // A 401 is an expired session, not an API outage — say so.
      const ex = err as { status?: number; code?: string };
      setError(ex?.status === 401 || ex?.code === 'UNAUTHENTICATED' ? 'auth' : 'offline');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (bootComplete && token) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootComplete, token]);

  const runAssist = async (mode: 'prompt' | 'polish' | 'title') => {
    setBusy(mode);
    try {
      const res = await assistDiary({
        mode,
        ...(mode !== 'prompt' ? { text: body } : {}),
        ...(mood ? { mood } : {}),
        ...(place ? { place } : {}),
      });
      if (mode === 'prompt') setPrompts(res.suggestions ?? []);
      if (mode === 'polish' && res.text) {
        setBody(res.text);
        setAiAssisted(true);
        toast.success('Polished your notes');
      }
      if (mode === 'title' && res.text) {
        setTitle(res.text);
        setAiAssisted(true);
        toast.success('Title suggested');
      }
    } catch {
      toast.error('Assistant unavailable — write on, it still saves');
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('A title and a few words are needed');
      return;
    }
    setBusy('save');
    try {
      const res = await createDiaryEntry({
        title: title.trim(),
        body: body.trim(),
        ...(mood ? { mood } : {}),
        aiAssisted,
      });
      setEntries((prev) => [res.entry, ...prev]);
      const g = await getGamification();
      setGame(g);
      const earned = res.gamification.newlyEarnedBadges;
      toast.success(
        `+${res.gamification.pointsAwarded} pts · ${res.gamification.currentStreak}-day streak` +
          (earned.length > 0 ? ` · new badge!` : ''),
      );
      setTitle('');
      setBody('');
      setMood('');
      setPrompts([]);
      setAiAssisted(false);
    } catch {
      toast.error('Could not save — try again');
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-gold-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back
      </Link>

      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-12 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold-500/20 blur-[120px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <NotebookPen aria-hidden className="h-3.5 w-3.5" /> Adventure Diary
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Your journey, in your words
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Write the day down — the assistant helps you start and polish, and every entry earns
          points, streaks, and badges.
        </p>
      </header>

      {!bootComplete || loading ? (
        <SkeletonCard count={2} />
      ) : !token || error === 'auth' ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-gold-600/15 bg-surface px-6 py-14 text-center shadow-(--shadow-depth-1)">
          <span className="grid h-16 w-16 place-items-center rounded-2xl border border-gold-500/25 bg-gold-500/8 text-gold-600 shadow-(--shadow-depth-1)">
            <ShieldAlert aria-hidden className="h-7 w-7" />
          </span>
          <h2 className="font-display text-xl font-semibold tracking-tight text-surface-foreground">
            {error === 'auth' ? 'Your session expired' : 'Sign in to start your diary'}
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            {error === 'auth' ? 'Your sign-in lapsed. ' : 'Your adventures are private to you. '}
            <Link href="/login" className="text-gold-600 underline-offset-4 hover:underline">
              Sign in
            </Link>{' '}
            {error === 'auth' ? 'again to keep writing.' : 'to begin writing.'}
          </p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-gold-600/15 bg-surface px-6 py-14 text-center shadow-(--shadow-depth-1)">
          <span className="grid h-16 w-16 place-items-center rounded-2xl border border-gold-500/25 bg-gold-500/8 text-gold-600 shadow-(--shadow-depth-1)">
            <CloudOff aria-hidden className="h-7 w-7" />
          </span>
          <h2 className="font-display text-xl font-semibold tracking-tight text-surface-foreground">
            The diary is offline
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            We couldn&apos;t reach the API. Once it&apos;s running your entries and badges appear
            here.
          </p>
          <Button variant="royal" onClick={refresh} className="mt-1">
            Try again
          </Button>
        </div>
      ) : (
        <>
          {game && <GamificationHud game={game} reduce={!!reduce} />}

          {/* Composer */}
          <section className="rounded-2xl border border-gold-600/15 bg-surface p-5 shadow-(--shadow-depth-1) sm:p-6">
            <h2 className="font-display text-xl font-semibold tracking-tight text-surface-foreground">
              New entry
            </h2>
            <div className="mt-4 space-y-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title — e.g. Day 3, the pass to Spiti"
                className="w-full rounded-xl border border-gold-600/20 bg-surface px-3.5 py-2.5 text-sm text-surface-foreground outline-none transition placeholder:text-muted/70 focus-visible:border-gold-600/50 focus-visible:ring-2 focus-visible:ring-accent"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={7}
                placeholder="What happened today? Write freely — the assistant can tidy it after."
                className="w-full resize-y rounded-xl border border-gold-600/20 bg-surface px-3.5 py-2.5 text-sm leading-relaxed text-surface-foreground outline-none transition placeholder:text-muted/70 focus-visible:border-gold-600/50 focus-visible:ring-2 focus-visible:ring-accent"
              />
              <div className="flex flex-wrap gap-2.5">
                <input
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  placeholder="Mood (joyful, adventurous…)"
                  className="w-48 rounded-xl border border-gold-600/20 bg-surface px-3 py-2 text-xs text-surface-foreground outline-none transition placeholder:text-muted/70 focus-visible:border-gold-600/50 focus-visible:ring-2 focus-visible:ring-accent"
                />
                <input
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder="Place (for prompts)"
                  className="w-44 rounded-xl border border-gold-600/20 bg-surface px-3 py-2 text-xs text-surface-foreground outline-none transition placeholder:text-muted/70 focus-visible:border-gold-600/50 focus-visible:ring-2 focus-visible:ring-accent"
                />
              </div>

              {/* AI assist */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
                  <Wand2 aria-hidden className="h-3.5 w-3.5 text-gold-600" /> Assist:
                </span>
                <button
                  type="button"
                  onClick={() => runAssist('prompt')}
                  disabled={busy !== null}
                  className="rounded-full border border-gold-600/25 px-3 py-1 text-xs font-medium text-surface-foreground transition hover:bg-gold-500/10 disabled:opacity-50"
                >
                  {busy === 'prompt' ? 'Thinking…' : 'Prompt me'}
                </button>
                <button
                  type="button"
                  onClick={() => runAssist('polish')}
                  disabled={busy !== null || !body.trim()}
                  className="rounded-full border border-gold-600/25 px-3 py-1 text-xs font-medium text-surface-foreground transition hover:bg-gold-500/10 disabled:opacity-50"
                >
                  {busy === 'polish' ? 'Polishing…' : 'Polish'}
                </button>
                <button
                  type="button"
                  onClick={() => runAssist('title')}
                  disabled={busy !== null || !body.trim()}
                  className="rounded-full border border-gold-600/25 px-3 py-1 text-xs font-medium text-surface-foreground transition hover:bg-gold-500/10 disabled:opacity-50"
                >
                  {busy === 'title' ? 'Titling…' : 'Title from text'}
                </button>
              </div>

              {prompts.length > 0 && (
                <ul className="space-y-1.5 rounded-xl border border-gold-600/15 bg-gold-500/5 p-3">
                  {prompts.map((p, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => setBody((b) => (b ? `${b}\n\n${p} ` : `${p} `))}
                        className="text-left text-sm text-surface-foreground transition hover:text-gold-600"
                      >
                        <Sparkles aria-hidden className="mr-1.5 inline h-3.5 w-3.5 text-gold-600" />
                        {p}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center justify-end gap-3 pt-1">
                {aiAssisted && (
                  <span className="text-xs text-muted">
                    <Sparkles aria-hidden className="mr-1 inline h-3 w-3 text-gold-600" />
                    Assisted (+15 pts)
                  </span>
                )}
                <Button variant="royal" onClick={save} disabled={busy !== null}>
                  {busy === 'save' ? 'Saving…' : 'Save entry'}
                </Button>
              </div>
            </div>
          </section>

          {/* Entries */}
          <section className="space-y-4">
            <h2 className="font-display text-xl font-semibold tracking-tight text-surface-foreground">
              Past adventures
            </h2>
            {entries.length === 0 ? (
              <p className="rounded-2xl border border-gold-600/15 bg-surface px-6 py-10 text-center text-sm text-muted shadow-(--shadow-depth-1)">
                No entries yet — your first one earns the{' '}
                <span className="text-gold-600">First Steps</span> badge.
              </p>
            ) : (
              <ul className="space-y-4">
                {entries.map((e, i) => (
                  <motion.li
                    key={e.id}
                    initial={reduce ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.3) }}
                  >
                    <article className="rounded-2xl border border-gold-600/12 bg-surface p-5 shadow-(--shadow-depth-1) transition hover:border-gold-600/25 hover:shadow-(--shadow-depth-2)">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-display text-lg font-semibold leading-snug tracking-tight text-surface-foreground">
                          {e.title}
                        </h3>
                        <div className="flex shrink-0 items-center gap-2">
                          {e.mood && <Badge variant="brand">{e.mood}</Badge>}
                          {e.aiAssisted && <Badge variant="gold">Assisted</Badge>}
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-muted">{fmtDate(e.entryDate)}</p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-surface-foreground/90">
                        {e.body}
                      </p>
                    </article>
                  </motion.li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function GamificationHud({ game, reduce }: { game: GamificationView; reduce: boolean }) {
  const stats: ReadonlyArray<{ label: string; value: string; icon: typeof Trophy }> = [
    { label: 'Points', value: game.totalPoints.toLocaleString(), icon: Gem },
    {
      label: 'Streak',
      value: `${game.currentStreak} day${game.currentStreak === 1 ? '' : 's'}`,
      icon: Flame,
    },
    { label: 'Best streak', value: `${game.longestStreak}`, icon: Trophy },
    { label: 'Entries', value: `${game.entryCount}`, icon: BookText },
  ];
  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-gold-600/20 p-5 shadow-(--shadow-depth-2) sm:p-6"
      style={{ backgroundImage: 'var(--gradient-royal)' }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-gold-500/15 blur-[100px]"
      />
      <div className="relative grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="text-center">
              <Icon aria-hidden className="mx-auto h-5 w-5 text-gold-300" />
              <p className="mt-1.5 font-display text-2xl font-semibold text-white">{s.value}</p>
              <p className="text-xs text-white/55">{s.label}</p>
            </div>
          );
        })}
      </div>
      <div className="relative mt-5 flex flex-wrap gap-2.5">
        {game.badges.map((b) => (
          <BadgeChip key={b.key} badge={b} reduce={reduce} />
        ))}
      </div>
    </section>
  );
}

function BadgeChip({ badge, reduce }: { badge: BadgeView; reduce: boolean }) {
  const Icon = BADGE_ICON[badge.icon] ?? Trophy;
  return (
    <motion.span
      initial={reduce || !badge.earned ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 18 }}
      title={`${badge.name} — ${badge.description}`}
      className={
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ' +
        (badge.earned
          ? 'border-gold-500/50 bg-gold-500/15 text-gold-200'
          : 'border-white/10 bg-white/5 text-white/35')
      }
    >
      {badge.earned ? (
        <Icon aria-hidden className="h-3.5 w-3.5" />
      ) : (
        <Lock aria-hidden className="h-3 w-3" />
      )}
      {badge.name}
    </motion.span>
  );
}

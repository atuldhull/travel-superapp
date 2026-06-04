/**
 * V.UX.28 — accessibility statement. Public, server-rendered. Linked
 * from the persistent footer in `app/layout.tsx`.
 *
 * Content tracks the V.UX.28 acceptance criteria + V.UX.15's comfort
 * mode — both are user-facing a11y features the page should call out
 * by name so a screen-reader user knows the affordances exist.
 *
 * Installed by prompt [V.UX.28]; restyled into the v2 ("Fusion")
 * design language (royal/gold tokens, font-display, cinematic header
 * band).
 */
import Link from 'next/link';
import { Accessibility, Keyboard, MailWarning } from 'lucide-react';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';

export default function AccessibilityPage() {
  return (
    <main className="space-y-8">
      {/* Cinematic royal header band — matches /home + /trips. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <Accessibility aria-hidden className="h-3.5 w-3.5" /> Built for everyone
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Accessibility statement
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Last reviewed 2026-05-02. We aim for WCAG 2.2 AA across every page.
        </p>
      </header>

      <Card depth="raised">
        <div className="space-y-6 text-sm">
          <section className="space-y-3">
            <CardHeader>
              <CardTitle className="text-xl">What we ship</CardTitle>
              <CardSubtitle>The affordances baked into every screen.</CardSubtitle>
            </CardHeader>
            <ul className="space-y-3">
              <li className="rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25">
                <p className="font-display font-semibold tracking-tight text-surface-foreground">
                  Skip-to-main link
                </p>
                <p className="mt-1 text-muted">
                  On every page so keyboard users can bypass the persistent header.
                </p>
              </li>
              <li className="rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25">
                <p className="font-display font-semibold tracking-tight text-surface-foreground">
                  Logical landmark structure
                </p>
                <p className="mt-1 text-muted">
                  <code>banner</code> header, <code>main</code> content, <code>contentinfo</code>{' '}
                  footer, <code>nav</code> primary navigation.
                </p>
              </li>
              <li className="rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25">
                <p className="font-display font-semibold tracking-tight text-surface-foreground">
                  ARIA live regions
                </p>
                <p className="mt-1 text-muted">
                  Announce async actions (save, archive, delete) to screen readers without stealing
                  focus.
                </p>
              </li>
              <li className="rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25">
                <p className="font-display font-semibold tracking-tight text-surface-foreground">
                  Keyboard fallback for drag-and-drop
                </p>
                <p className="mt-1 text-muted">
                  Every drag handle is reachable via Tab and supports Arrow Up / Arrow Down to
                  reorder, plus Home / End to jump to the ends. (
                  <Link
                    href={'/trips' as never}
                    className="text-gold-700 underline underline-offset-4 transition hover:text-gold-600 dark:text-gold-300"
                  >
                    Try a trip
                  </Link>{' '}
                  — open a trip detail and Tab into the day-by-day list.)
                </p>
              </li>
              <li className="rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25">
                <p className="font-display font-semibold tracking-tight text-surface-foreground">
                  Comfort mode (V.UX.15)
                </p>
                <p className="mt-1 text-muted">
                  Bumps the body font size to 1.25×, line-height to 1.65, and enforces 44 px minimum
                  tap targets. Toggle from{' '}
                  <Link
                    href={'/account/preferences' as never}
                    className="text-gold-700 underline underline-offset-4 transition hover:text-gold-600 dark:text-gold-300"
                  >
                    Account preferences
                  </Link>
                  .
                </p>
              </li>
              <li className="rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25">
                <p className="font-display font-semibold tracking-tight text-surface-foreground">
                  Visible focus rings
                </p>
                <p className="mt-1 text-muted">
                  On every interactive element — never <code>outline: none</code> without a
                  replacement.
                </p>
              </li>
              <li className="rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25">
                <p className="font-display font-semibold tracking-tight text-surface-foreground">
                  Light + dark themes
                </p>
                <p className="mt-1 text-muted">
                  Respect <code>prefers-color-scheme</code> and the explicit toggle in the header.
                  Both meet AA contrast minimums.
                </p>
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Keyboard aria-hidden className="h-5 w-5 text-gold-600 dark:text-gold-300" /> Known
                gaps
              </CardTitle>
              <CardSubtitle>Where we&apos;re not all the way there yet.</CardSubtitle>
            </CardHeader>
            <ul className="space-y-3">
              <li className="rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25">
                <p className="text-muted">
                  The interactive map on the trip route view (Leaflet) inherits vendor-default
                  keyboard behaviour. Use the <em>day-by-day list</em> view as the keyboard-primary
                  alternative.
                </p>
              </li>
              <li className="rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25">
                <p className="text-muted">
                  The PDF export and email handoff (V.UX.5) are non-interactive outputs; the source
                  itinerary is fully accessible.
                </p>
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <MailWarning aria-hidden className="h-5 w-5 text-gold-600 dark:text-gold-300" />{' '}
                Found a barrier?
              </CardTitle>
            </CardHeader>
            <p className="rounded-2xl border border-gold-600/12 bg-surface p-4 text-muted shadow-(--shadow-depth-1)">
              Email{' '}
              <a
                href="mailto:accessibility@travelsuperapp.local"
                className="text-gold-700 underline underline-offset-4 transition hover:text-gold-600 dark:text-gold-300"
              >
                accessibility@travelsuperapp.local
              </a>{' '}
              with the URL, the assistive technology you use, and a description. We aim to respond
              within two business days.
            </p>
          </section>
        </div>
      </Card>
    </main>
  );
}

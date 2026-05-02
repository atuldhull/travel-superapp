/**
 * V.UX.28 — accessibility statement. Public, server-rendered. Linked
 * from the persistent footer in `app/layout.tsx`.
 *
 * Content tracks the V.UX.28 acceptance criteria + V.UX.15's comfort
 * mode — both are user-facing a11y features the page should call out
 * by name so a screen-reader user knows the affordances exist.
 *
 * Installed by prompt [V.UX.28].
 */
import Link from 'next/link';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';

export default function AccessibilityPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Accessibility statement</CardTitle>
          <CardSubtitle>
            Last reviewed 2026-05-02. We aim for WCAG 2.2 AA across every page.
          </CardSubtitle>
        </CardHeader>
        <div className="space-y-4 text-sm">
          <section className="space-y-2">
            <h2 className="text-base font-semibold">What we ship</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Skip-to-main link</strong> on every page so keyboard users can bypass the
                persistent header.
              </li>
              <li>
                <strong>Logical landmark structure</strong>: <code>banner</code> header,{' '}
                <code>main</code> content, <code>contentinfo</code> footer, <code>nav</code> primary
                navigation.
              </li>
              <li>
                <strong>ARIA live regions</strong> announce async actions (save, archive, delete) to
                screen readers without stealing focus.
              </li>
              <li>
                <strong>Keyboard fallback for drag-and-drop</strong>: every drag handle is reachable
                via Tab and supports Arrow Up / Arrow Down to reorder, plus Home / End to jump to
                the ends. (
                <Link href={'/trips' as never} className="text-brand underline">
                  Try a trip
                </Link>{' '}
                — open a trip detail and Tab into the day-by-day list.)
              </li>
              <li>
                <strong>Comfort mode</strong> (V.UX.15) bumps the body font size to 1.25×,
                line-height to 1.65, and enforces 44 px minimum tap targets. Toggle from{' '}
                <Link href={'/account/preferences' as never} className="text-brand underline">
                  Account preferences
                </Link>
                .
              </li>
              <li>
                <strong>Visible focus rings</strong> on every interactive element — never{' '}
                <code>outline: none</code> without a replacement.
              </li>
              <li>
                <strong>Light + dark themes</strong> respect <code>prefers-color-scheme</code> and
                the explicit toggle in the header. Both meet AA contrast minimums.
              </li>
            </ul>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold">Known gaps</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>
                The interactive map on the trip route view (Leaflet) inherits vendor-default
                keyboard behaviour. Use the <em>day-by-day list</em> view as the keyboard-primary
                alternative.
              </li>
              <li>
                The PDF export and email handoff (V.UX.5) are non-interactive outputs; the source
                itinerary is fully accessible.
              </li>
            </ul>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold">Found a barrier?</h2>
            <p>
              Email{' '}
              <a href="mailto:accessibility@travelsuperapp.local" className="text-brand underline">
                accessibility@travelsuperapp.local
              </a>{' '}
              with the URL, the assistive technology you use, and a description. We aim to respond
              within two business days.
            </p>
          </section>
        </div>
      </Card>
    </div>
  );
}

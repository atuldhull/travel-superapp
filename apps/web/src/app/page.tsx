/**
 * Landing page. Server Component (default in App Router) — no
 * client interactivity yet.
 *
 * Installed by [IV.18.19.14]; Tailwind theming [IV.18.19.18].
 */
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">TravelSuperApp</h1>
      <p className="text-base leading-relaxed">
        A user enters a place + radius; the app generates a full itinerary (places, stays, food,
        events, transport, weather, crowd, safety, prices, translation, 3D previews) and stays with
        them through the trip.
      </p>
      <p>
        <Link
          href="/featured"
          className="inline-flex items-center gap-1 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition hover:opacity-90"
        >
          Browse featured memory books →
        </Link>
      </p>
      <hr className="border-t border-muted/20" />
      <p className="text-sm text-muted">
        Scaffold installed by <code className="rounded bg-muted/10 px-1 py-0.5">[IV.18.19.14]</code>
        . Real design system + auth flow + trip planner land in follow-up slices.
      </p>
    </main>
  );
}

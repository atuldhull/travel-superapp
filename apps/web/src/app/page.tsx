/**
 * Landing page. Server Component (default in App Router) — no
 * client interactivity yet.
 *
 * Installed by prompt [IV.18.19.14].
 */
import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <h1>TravelSuperApp</h1>
      <p>
        A user enters a place + radius; the app generates a full itinerary (places, stays, food,
        events, transport, weather, crowd, safety, prices, translation, 3D previews) and stays with
        them through the trip.
      </p>
      <p>
        <Link href="/featured">Browse featured memory books →</Link>
      </p>
      <hr style={{ margin: '2rem 0', opacity: 0.2 }} />
      <p style={{ fontSize: '0.875rem', opacity: 0.7 }}>
        Scaffold installed by <code>[IV.18.19.14]</code>. Real design system + auth flow + trip
        planner land in follow-up slices.
      </p>
    </main>
  );
}

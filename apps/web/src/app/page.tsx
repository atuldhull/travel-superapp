/**
 * Landing page — first-time-visitor experience.
 *
 * Layout (top → bottom):
 *   1. Hero            — value prop + dual CTA + animated illustration
 *   2. Sample-trip     — live demo widget (calls public /trips/sample-plan)
 *   3. Value pillars   — three things we do better
 *   4. Featured strip  — social proof from /memory-books/featured
 *
 * Renders without auth. Sections 1, 3 are Server Components; 2, 4 are
 * client components that hit the typed sdk hooks. Mobile-first
 * responsive (375px → 1440px).
 *
 * Installed by [IV.18.19.14]; Tailwind theming [IV.18.19.18];
 * full rebuild for first-time visitors in [V.UX.1].
 */
import { LandingHero } from '../components/landing/hero';
import { SampleTripDemo } from '../components/landing/sample-trip-demo';
import { ValuePillars } from '../components/landing/value-pillars';
import { FeaturedStrip } from '../components/landing/featured-strip';

export default function HomePage() {
  return (
    <main className="space-y-12 sm:space-y-16">
      <LandingHero />
      <SampleTripDemo />
      <ValuePillars />
      <FeaturedStrip />
    </main>
  );
}

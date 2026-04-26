/**
 * Landing page — first-time-visitor + returning-visitor experience.
 *
 * Layout (top → bottom):
 *   0. Welcome-back banner — only on 2nd+ visit (V.UX.2)
 *   1. Hero                — value prop + dual CTA + animated illustration
 *   2. Sample-trip         — live demo widget (calls public /trips/sample-plan)
 *   3. Value pillars       — three things we do better
 *   4. Featured strip      — social proof from /memory-books/featured
 *
 * Renders without auth. Sections 1, 3 are Server Components; 0, 2, 4
 * are client components that hit localStorage / the typed sdk hooks.
 * Mobile-first responsive (375px → 1440px).
 *
 * Installed by [IV.18.19.14]; Tailwind theming [IV.18.19.18];
 * full rebuild for first-time visitors in [V.UX.1];
 * welcome-back banner + visit-recall in [V.UX.2].
 */
import { LandingHero } from '../components/landing/hero';
import { SampleTripDemo } from '../components/landing/sample-trip-demo';
import { ValuePillars } from '../components/landing/value-pillars';
import { FeaturedStrip } from '../components/landing/featured-strip';
import { WelcomeBackBanner } from '../components/landing/welcome-back-banner';

export default function HomePage() {
  return (
    <main className="space-y-12 sm:space-y-16">
      <WelcomeBackBanner />
      <LandingHero />
      <SampleTripDemo />
      <ValuePillars />
      <FeaturedStrip />
    </main>
  );
}

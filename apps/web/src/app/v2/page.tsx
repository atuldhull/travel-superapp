/**
 * /v2 — the premium "Fusion" landing (dark cinematic hero → light
 * editorial body). Full-bleed (bare route in app-chrome.tsx), own nav +
 * footer. Content is REAL: curated destinations / moments / journeys
 * from the app's own data, and the genuinely-live AI Trip Planner
 * (/trips/sample-plan). No invented prices, ratings, or stats.
 *
 * Preview route — compare to `/`, then we promote it.
 */
import type { Metadata } from 'next';
import { V2Hero } from '@/components/v2/hero';
import { V2ValuePillars } from '@/components/v2/value-pillars';
import { V2FeaturedDestinations } from '@/components/v2/featured-destinations';
import { V2Experiences } from '@/components/v2/experiences';
import { V2Packages } from '@/components/v2/packages';
import { V2PlanCta } from '@/components/v2/plan-cta';
import { V2Footer } from '@/components/v2/footer';

const TITLE = 'TravelSuperApp · Discover Places Beyond Imagination';
const DESC =
  'Luxury travel curated by AI — personalised itineraries, real curated destinations, and extraordinary experiences, planned in seconds.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  robots: { index: false, follow: false },
};

export default function V2Page(): React.ReactElement {
  return (
    <div className="bg-surface text-surface-foreground">
      <V2Hero />
      <V2ValuePillars />
      <V2FeaturedDestinations />
      <V2Experiences />
      <V2Packages />
      <V2PlanCta />
      <V2Footer />
    </div>
  );
}

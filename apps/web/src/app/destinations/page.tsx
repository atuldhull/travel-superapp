/**
 * /destinations — curated destination guides.
 *
 * A browsable catalog of the app's hand-authored destination guides
 * (India + world). Each card opens a long-form guide at
 * /destinations/[slug]. Public, content-rich surface — re-surfaces the
 * editorial destination content into the new web's v2 design.
 */
import type { Metadata } from 'next';
import { Compass } from 'lucide-react';
import { DestinationsCatalog } from '../../components/v2/destinations-catalog';

const TITLE = 'Destinations · TravelSuperApp';
const DESC =
  'Curated travel guides across India and the world — facts, moments worth the journey, and suggested itineraries you can plan in seconds.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
};

export default function DestinationsPage(): React.ReactElement {
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
          <Compass aria-hidden className="h-3.5 w-3.5" /> Destination guides
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Where will you wander?
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Hand-curated guides across India and the world — open one for the moments worth the
          journey, then let the AI plan it in seconds.
        </p>
      </header>

      <DestinationsCatalog />
    </main>
  );
}

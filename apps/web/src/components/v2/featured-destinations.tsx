/**
 * v2 featured destinations — the app's REAL curated destinations
 * (components/aether/destinations/data.ts): real photos, real names,
 * real taglines. No invented prices or ratings. Server component.
 */
import { DESTINATIONS, FEATURED_SLUGS } from '../aether/destinations/data';
import { Section, SectionHeading } from './kit';
import { V2Photo } from './photo';

// A curated, balanced mix (India + world, alternating) rather than the
// full ~29-strong map — see FEATURED_SLUGS in the destination data.
const ITEMS = FEATURED_SLUGS.map((slug) => DESTINATIONS[slug]).filter(
  (d): d is (typeof DESTINATIONS)[string] => d !== undefined,
);

export function V2FeaturedDestinations(): React.ReactElement {
  return (
    <Section id="destinations">
      <SectionHeading
        eyebrow="Featured Destinations"
        title="Where will you wander next?"
        dek="Real, hand-curated places across India and the world — tap one and the AI plans it in seconds."
        action={{ href: '#plan', label: 'Plan a trip' }}
      />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((d) => (
          <a
            key={d.slug}
            href="#plan"
            className="group relative block overflow-hidden rounded-2xl border border-gold-600/12 shadow-(--shadow-depth-2) transition duration-300 hover:-translate-y-1 hover:shadow-(--shadow-depth-3) focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <V2Photo
              id={d.hero.id}
              alt={`${d.name}, ${d.state}`}
              scrim
              rounded="rounded-2xl"
              className="aspect-4/5 w-full transition duration-700 group-hover:scale-105"
            />
            <span className="absolute left-4 top-4 rounded-full bg-black/35 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {d.state}
            </span>
            <div className="absolute inset-x-0 bottom-0 p-5">
              <h3 className="font-display text-2xl font-semibold text-white">{d.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-white/75">{d.tagline}</p>
            </div>
          </a>
        ))}
      </div>
    </Section>
  );
}

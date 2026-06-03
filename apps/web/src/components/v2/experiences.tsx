/**
 * v2 curated experiences — REAL "moments" pulled from the app's
 * destination data (each has a real title, body, and photo). No fake
 * marketing copy. Server component.
 */
import { ArrowUpRight } from 'lucide-react';
import { DESTINATIONS } from '../aether/destinations/data';
import { Section, SectionHeading } from './kit';
import { V2Photo } from './photo';

// One signature moment from each of the first three destinations.
const MOMENTS = Object.values(DESTINATIONS)
  .slice(0, 3)
  .flatMap((d) => {
    const m = d.moments[0];
    return m ? [{ dest: d.name, moment: m }] : [];
  });

export function V2Experiences(): React.ReactElement {
  return (
    <Section id="experiences" className="pt-0 sm:pt-0 lg:pt-0">
      <SectionHeading
        eyebrow="Curated Experiences"
        title="Moments worth the journey"
        action={{ href: '#plan', label: 'Plan yours' }}
      />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {MOMENTS.map(({ dest, moment }) => (
          <a
            key={moment.title}
            href="#plan"
            className="group relative block overflow-hidden rounded-2xl border border-gold-600/12 shadow-(--shadow-depth-2) transition duration-300 hover:-translate-y-1 hover:shadow-(--shadow-depth-3) focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <V2Photo
              id={moment.photo.id}
              alt={moment.photo.alt}
              scrim
              rounded="rounded-2xl"
              className="aspect-4/3 w-full transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gold-200">{dest}</p>
                <h3 className="mt-0.5 font-display text-lg font-semibold text-white">
                  {moment.title}
                </h3>
                <p className="mt-0.5 line-clamp-2 max-w-[18rem] text-sm text-white/70">
                  {moment.body}
                </p>
              </div>
              <span className="inline-flex shrink-0 rounded-full bg-white/15 p-2 text-white backdrop-blur-sm transition group-hover:bg-white group-hover:text-brand-900">
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </span>
            </div>
          </a>
        ))}
      </div>
    </Section>
  );
}

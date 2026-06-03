/**
 * v2 curated journeys — REAL suggested itineraries from the app's
 * destination data (name + days + lede). No invented prices. Server
 * component.
 */
import { ArrowRight, CalendarDays } from 'lucide-react';
import { DESTINATIONS } from '../aether/destinations/data';
import { Section, SectionHeading } from './kit';
import { V2Photo } from './photo';

const JOURNEYS = Object.values(DESTINATIONS)
  .slice(0, 2)
  .flatMap((d) => {
    const it = d.itineraries[0];
    return it ? [{ dest: d, it }] : [];
  });

export function V2Packages(): React.ReactElement {
  return (
    <Section id="packages" className="pt-0 sm:pt-0 lg:pt-0">
      <SectionHeading
        eyebrow="Curated Journeys"
        title="Routes worth following"
        action={{ href: '#plan', label: 'Plan a journey' }}
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {JOURNEYS.map(({ dest, it }) => (
          <div
            key={it.name}
            className="group relative overflow-hidden rounded-3xl border border-gold-600/12 shadow-(--shadow-depth-2) transition duration-300 hover:shadow-(--shadow-depth-3)"
          >
            <V2Photo
              id={dest.hero.id}
              alt={dest.name}
              scrim
              rounded="rounded-3xl"
              className="aspect-16/10 w-full transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 flex flex-col justify-end p-7">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-gold-200">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden /> {it.days} days · {dest.name}
              </p>
              <h3 className="mt-1.5 font-display text-3xl font-semibold text-white">{it.name}</h3>
              <p className="mt-2 line-clamp-2 max-w-md text-sm text-white/75">{it.lede}</p>
              <a
                href="#plan"
                className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-900 transition hover:-translate-y-0.5"
              >
                Plan this journey <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

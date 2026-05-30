'use client';

/**
 * <ComparePage> — side-by-side destinations.
 *
 * Reads `?a=<slug>&b=<slug>` from the URL. If either is missing, shows
 * a chooser grid. If both resolve, renders a two-column composition:
 *   • Twin hero band with per-destination accent gradient overlays
 *   • Facts table (one row per fact label, left + right columns)
 *   • Lede excerpts (italic-serif, narrow column)
 *   • Moments preview (first 3 from each)
 *   • "Plan this trip" CTA pairs at the bottom
 *
 * The accents derive from `destinationAccent(slug)` (AE61). The
 * background fades from the left destination's accent to the right's
 * via a 45° linear gradient on the divider band.
 */
import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '@app/aether-core';
import { DriftNav } from '../../drift-nav';
import { Reveal } from '../../drift-sections/reveal';
import { EditorialFooter } from '../../drift-sections/editorial-footer';
import { useViewport } from '../../use-viewport';
import { SafeImg } from '../../safe-img';
import { photoUrl } from '../../photos';
import { ALL_SLUGS, DESTINATIONS, type Destination } from '../data';
import { destinationAccent } from '../palette';

function pick(slug: string | null): Destination | null {
  if (slug === null) return null;
  return DESTINATIONS[slug] ?? null;
}

export function ComparePage(): React.ReactElement {
  const theme = useTheme();
  const { isNarrow } = useViewport();
  const router = useRouter();
  const sp = useSearchParams();
  const aSlug = sp.get('a');
  const bSlug = sp.get('b');
  const a = pick(aSlug);
  const b = pick(bSlug);

  const accentA = destinationAccent(aSlug ?? '');
  const accentB = destinationAccent(bSlug ?? '');

  // The full list of facts is normalised to the union of labels so
  // both columns line up even if one destination doesn't define a
  // particular fact (rare — the data has 3 facts per dest).
  const factLabels = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const f of a?.facts ?? []) set.add(f.label);
    for (const f of b?.facts ?? []) set.add(f.label);
    return Array.from(set);
  }, [a, b]);

  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const ochre = theme.palette.ochre;
  const olive = theme.palette.olive;

  function setSlot(slot: 'a' | 'b', slug: string): void {
    const other = slot === 'a' ? bSlug : aSlug;
    const next = new URLSearchParams();
    next.set('a', slot === 'a' ? slug : (other ?? ''));
    next.set('b', slot === 'b' ? slug : (other ?? ''));
    router.push(`/aether/destinations/compare?${next.toString()}`);
  }

  return (
    <div
      style={{
        background: surface.base,
        color: ink.base,
        fontFamily: theme.font.ui,
        minHeight: '100vh',
      }}
    >
      <DriftNav />

      <section
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: isNarrow
            ? `${theme.space.hero}px ${theme.space.comfy}px ${theme.space.gutter}px`
            : `${theme.space.surface}px ${theme.space.margin}px ${theme.space.hero}px`,
        }}
      >
        <Reveal>
          <p
            style={{
              fontFamily: theme.font.ui,
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: accentA.deep,
              fontWeight: 600,
              margin: 0,
            }}
          >
            Compare · two roads at once
          </p>
          <h1
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(40px, 6vw, 84px)',
              lineHeight: 1.02,
              letterSpacing: '-0.024em',
              fontWeight: 600,
              margin: `${theme.space.tight}px 0 0`,
              color: ink.base,
            }}
          >
            {a !== null && b !== null ? `${a.name} vs ${b.name}.` : 'Pick two destinations.'}
          </h1>
        </Reveal>

        {/* Slot pickers */}
        <Reveal>
          <div
            style={{
              marginTop: theme.space.hero,
              display: 'grid',
              gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr',
              gap: theme.space.gutter,
            }}
          >
            {(['a', 'b'] as const).map((slot) => {
              const current = slot === 'a' ? a : b;
              const accent = slot === 'a' ? accentA : accentB;
              return (
                <div key={slot}>
                  <p
                    style={{
                      fontFamily: theme.font.ui,
                      fontSize: 11,
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      color: accent.deep,
                      fontWeight: 600,
                      margin: 0,
                      marginBottom: theme.space.tight,
                    }}
                  >
                    {slot === 'a' ? 'Left road' : 'Right road'}
                  </p>
                  <select
                    value={current?.slug ?? ''}
                    onChange={(e) => setSlot(slot, e.target.value)}
                    aria-label={`Choose the ${slot === 'a' ? 'left' : 'right'} destination`}
                    style={{
                      width: '100%',
                      padding: `${theme.space.tight}px ${theme.space.comfy}px`,
                      borderRadius: theme.radius.pill,
                      border: `1px solid ${accent.deep}`,
                      background: accent.whisper,
                      color: ink.base,
                      fontFamily: theme.font.display,
                      fontSize: 18,
                      outline: 'none',
                    }}
                  >
                    <option value="">— pick a destination —</option>
                    {ALL_SLUGS.map((s) => (
                      <option key={s} value={s}>
                        {DESTINATIONS[s]?.name} · {DESTINATIONS[s]?.state}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </Reveal>

        {/* Twin hero band */}
        {a !== null && b !== null && (
          <Reveal>
            <div
              style={{
                marginTop: theme.space.hero,
                display: 'grid',
                gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr',
                gap: 0,
                borderRadius: theme.radius.lg,
                overflow: 'hidden',
                position: 'relative',
                border: `1px solid ${ink.whisper}`,
              }}
            >
              {[a, b].map((d, i) => {
                const accent = i === 0 ? accentA : accentB;
                return (
                  <div
                    key={d.slug}
                    style={{
                      position: 'relative',
                      aspectRatio: isNarrow ? '16 / 9' : '4 / 3',
                      background: accent.deep,
                      overflow: 'hidden',
                    }}
                  >
                    <SafeImg
                      src={photoUrl(d.hero, 1200)}
                      alt={d.hero.alt}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: 0.78,
                      }}
                    />
                    <div
                      aria-hidden
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: `linear-gradient(${i === 0 ? '135deg' : '225deg'}, ${accent.base} 0%, rgba(24, 15, 11, 0) 60%, rgba(24, 15, 11, 0.55) 100%)`,
                      }}
                    />
                    <div
                      style={{
                        position: 'relative',
                        zIndex: 1,
                        padding: theme.space.gutter,
                        color: surface.base,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <p
                        style={{
                          fontFamily: theme.font.ui,
                          fontSize: 11,
                          letterSpacing: '0.22em',
                          textTransform: 'uppercase',
                          color: ochre.glow,
                          fontWeight: 600,
                          margin: 0,
                        }}
                      >
                        {d.state} · {accent.note}
                      </p>
                      <h2
                        style={{
                          fontFamily: theme.font.display,
                          fontSize: 'clamp(32px, 4.4vw, 56px)',
                          lineHeight: 1.0,
                          letterSpacing: '-0.022em',
                          fontWeight: 600,
                          margin: `${theme.space.tight}px 0 0`,
                          textShadow: '0 2px 24px rgba(24, 15, 11, 0.5)',
                        }}
                      >
                        {d.name}.
                      </h2>
                      <p
                        style={{
                          fontFamily: theme.font.display,
                          fontStyle: 'italic',
                          fontSize: 18,
                          lineHeight: 1.4,
                          margin: `${theme.space.tight}px 0 0`,
                          maxWidth: '32ch',
                          opacity: 0.92,
                        }}
                      >
                        {d.tagline}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Reveal>
        )}

        {/* Facts comparison */}
        {a !== null && b !== null && (
          <Reveal>
            <div
              style={{
                marginTop: theme.space.hero,
                border: `1px solid ${ink.whisper}`,
                borderRadius: theme.radius.lg,
                background: surface.soft,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  borderBottom: `1px solid ${ink.whisper}`,
                  background: surface.base,
                }}
              >
                {['', a.name, b.name].map((h, i) => (
                  <div
                    key={`head-${i}`}
                    style={{
                      padding: `${theme.space.comfy}px ${theme.space.loose}px`,
                      fontFamily: theme.font.ui,
                      fontSize: 11,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: i === 0 ? ink.soft : i === 1 ? accentA.deep : accentB.deep,
                      fontWeight: 600,
                    }}
                  >
                    {h || 'Fact'}
                  </div>
                ))}
              </div>
              {factLabels.map((label) => {
                const av = a.facts.find((f) => f.label === label)?.value ?? '—';
                const bv = b.facts.find((f) => f.label === label)?.value ?? '—';
                return (
                  <div
                    key={label}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      borderBottom: `1px solid ${ink.whisper}`,
                    }}
                  >
                    <div
                      style={{
                        padding: `${theme.space.comfy}px ${theme.space.loose}px`,
                        fontFamily: theme.font.ui,
                        fontSize: 11,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: ink.soft,
                        fontWeight: 600,
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        padding: `${theme.space.comfy}px ${theme.space.loose}px`,
                        fontFamily: theme.font.display,
                        fontSize: 18,
                        fontWeight: 600,
                        color: ink.base,
                      }}
                    >
                      {av}
                    </div>
                    <div
                      style={{
                        padding: `${theme.space.comfy}px ${theme.space.loose}px`,
                        fontFamily: theme.font.display,
                        fontSize: 18,
                        fontWeight: 600,
                        color: ink.base,
                        borderLeft: `1px solid ${ink.whisper}`,
                      }}
                    >
                      {bv}
                    </div>
                  </div>
                );
              })}
            </div>
          </Reveal>
        )}

        {/* Ledes side-by-side */}
        {a !== null && b !== null && (
          <Reveal>
            <div
              style={{
                marginTop: theme.space.hero,
                display: 'grid',
                gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr',
                gap: theme.space.gutter,
              }}
            >
              {[a, b].map((d, i) => {
                const accent = i === 0 ? accentA : accentB;
                return (
                  <div
                    key={`lede-${d.slug}`}
                    style={{
                      padding: theme.space.loose,
                      borderRadius: theme.radius.lg,
                      background: accent.whisper,
                      borderLeft: `3px solid ${accent.base}`,
                    }}
                  >
                    <p
                      style={{
                        fontFamily: theme.font.ui,
                        fontSize: 11,
                        letterSpacing: '0.22em',
                        textTransform: 'uppercase',
                        color: accent.deep,
                        fontWeight: 600,
                        margin: 0,
                        marginBottom: theme.space.tight,
                      }}
                    >
                      What it&apos;s like
                    </p>
                    <p
                      style={{
                        fontFamily: theme.font.display,
                        fontStyle: 'italic',
                        fontSize: 18,
                        lineHeight: 1.55,
                        color: ink.base,
                        margin: 0,
                      }}
                    >
                      {d.lede}
                    </p>
                  </div>
                );
              })}
            </div>
          </Reveal>
        )}

        {/* Plan CTAs */}
        {a !== null && b !== null && (
          <Reveal>
            <div
              style={{
                marginTop: theme.space.hero,
                display: 'grid',
                gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr',
                gap: theme.space.gutter,
              }}
            >
              {[a, b].map((d, i) => {
                const accent = i === 0 ? accentA : accentB;
                return (
                  <Link
                    key={`cta-${d.slug}`}
                    href={`/aether/plan?where=${encodeURIComponent(d.name)}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: theme.space.tight,
                      padding: `${theme.space.comfy}px ${theme.space.loose}px`,
                      borderRadius: theme.radius.pill,
                      background: accent.base,
                      color: surface.base,
                      fontFamily: theme.font.ui,
                      fontSize: theme.text.button.size,
                      fontWeight: theme.text.button.weight,
                      textDecoration: 'none',
                      letterSpacing: '0.01em',
                    }}
                  >
                    <span>Begin the {d.name} yatra</span>
                    <span aria-hidden>→</span>
                  </Link>
                );
              })}
            </div>
          </Reveal>
        )}

        {/* Empty state when one or both is missing */}
        {(a === null || b === null) && (
          <Reveal>
            <p
              style={{
                marginTop: theme.space.hero,
                fontFamily: theme.font.display,
                fontStyle: 'italic',
                fontSize: 20,
                lineHeight: 1.55,
                color: ink.soft,
                maxWidth: '52ch',
              }}
            >
              Use the dropdowns above to pick two destinations. The URL updates as you choose, so
              you can share the comparison directly.
            </p>
            <p
              style={{
                marginTop: theme.space.tight,
                fontFamily: theme.font.mono,
                fontSize: 11,
                color: olive.deep,
                letterSpacing: '0.12em',
                opacity: 0.85,
              }}
            >
              try{' '}
              <Link
                href="/aether/destinations/compare?a=jaipur&b=alleppey"
                style={{ color: olive.deep, textDecoration: 'underline' }}
              >
                Jaipur vs Alleppey
              </Link>
            </p>
          </Reveal>
        )}
      </section>

      <EditorialFooter />
    </div>
  );
}

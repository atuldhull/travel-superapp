'use client';

/**
 * <AtlasCanvas> — the map surface (Phase 0 sketch).
 *
 * Editorial "constellation map" rather than a literal geographic India.
 * The six destinations are positioned roughly geographically on an
 * espresso-night background, connected by thin gold filament lines
 * suggesting a journey. Each is a glowing point that expands on hover
 * and reveals a floating card with name + tagline + state. Click
 * navigates to the destination detail page.
 *
 * Designed to feel like a hand-drawn travel journal endpaper: north
 * is up, but distances are not to scale, and the lines are an
 * editorial gesture (not a routing engine).
 */
import { useState } from 'react';
import Link from 'next/link';
import { useTheme, useMotionPolicy } from '@app/aether-core';
import { DriftNav } from '../drift-nav';
import { Reveal } from '../drift-sections/reveal';
import { EditorialFooter } from '../drift-sections/editorial-footer';

interface Pin {
  readonly slug: string;
  readonly name: string;
  readonly state: string;
  readonly tagline: string;
  /** Position in viewBox units (0..100, 0..100). North is up. */
  readonly x: number;
  readonly y: number;
}

/** Ten destinations, positioned with approximate geographic flair —
 *  not pixel-accurate to lat/lng but recognisable. Leh up top, Kerala
 *  at the bottom, Varanasi on the east, Goa/Hampi mid-south-west,
 *  Mumbai on the west coast, Pondicherry on the east coast. */
const PINS: readonly Pin[] = [
  {
    slug: 'leh',
    name: 'Leh',
    state: 'Ladakh',
    tagline: 'High monasteries, thin air.',
    x: 38,
    y: 8,
  },
  {
    slug: 'spiti',
    name: 'Spiti',
    state: 'Himachal Pradesh',
    tagline: 'Trans-Himalayan high desert.',
    x: 32,
    y: 18,
  },
  {
    slug: 'jaipur',
    name: 'Jaipur',
    state: 'Rajasthan',
    tagline: 'Pink city of forts.',
    x: 34,
    y: 32,
  },
  {
    slug: 'varanasi',
    name: 'Varanasi',
    state: 'Uttar Pradesh',
    tagline: 'The oldest living city.',
    x: 62,
    y: 38,
  },
  {
    slug: 'mumbai',
    name: 'Mumbai',
    state: 'Maharashtra',
    tagline: 'A city of seven islands.',
    x: 22,
    y: 54,
  },
  {
    slug: 'anjuna',
    name: 'Anjuna',
    state: 'Goa',
    tagline: 'Susegad — beach & cafés.',
    x: 26,
    y: 64,
  },
  {
    slug: 'hampi',
    name: 'Hampi',
    state: 'Karnataka',
    tagline: 'A vanished empire in granite.',
    x: 36,
    y: 70,
  },
  {
    slug: 'coorg',
    name: 'Coorg',
    state: 'Karnataka',
    tagline: 'Coffee country in the mist.',
    x: 32,
    y: 78,
  },
  {
    slug: 'pondicherry',
    name: 'Pondicherry',
    state: 'Tamil Nadu',
    tagline: 'A French quarter on the bay.',
    x: 52,
    y: 80,
  },
  {
    slug: 'alleppey',
    name: 'Alleppey',
    state: 'Kerala',
    tagline: 'Backwaters & houseboats.',
    x: 36,
    y: 90,
  },
];

/** Order in which to draw the connecting line — descending route. */
const LINE_ORDER: readonly number[] = [0, 1, 2, 3, 6, 5, 4, 7, 9, 8, 3];

export function AtlasCanvas(): React.ReactElement {
  const theme = useTheme();
  const motionPolicy = useMotionPolicy();
  const [hovered, setHovered] = useState<string | null>(null);

  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;
  const ochre = theme.palette.ochre;
  const olive = theme.palette.olive;

  // Build the polyline path through the LINE_ORDER pins.
  const linePath = LINE_ORDER.map((idx) => `${PINS[idx]!.x},${PINS[idx]!.y}`).join(' ');

  return (
    <div
      style={{
        background: ink.base,
        color: surface.base,
        minHeight: '100vh',
        fontFamily: theme.font.ui,
      }}
    >
      <DriftNav />

      {/* ─── HEADER ───────────────────────────────────────────────────── */}
      <Reveal as="section">
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: `${theme.space.surface}px ${theme.space.margin}px ${theme.space.loose}px`,
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: theme.font.ui,
              fontSize: theme.text.small.size,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: ochre.glow,
              fontWeight: 600,
              margin: 0,
              marginBottom: theme.space.tight,
            }}
          >
            Atlas · the constellation
          </p>
          <h1
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(40px, 6vw, 84px)',
              lineHeight: 1.02,
              letterSpacing: '-0.024em',
              fontWeight: 600,
              margin: 0,
              color: surface.base,
            }}
          >
            A map drawn by journeys, not by borders.
          </h1>
          <p
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(18px, 2vw, 23px)',
              fontStyle: 'italic',
              lineHeight: 1.55,
              maxWidth: '54ch',
              margin: `${theme.space.comfy}px auto 0`,
              color: surface.soft,
              opacity: 0.85,
            }}
          >
            Six places, one country, a thousand routes between them. Hover to read; click to wander.
          </p>
        </div>
      </Reveal>

      {/* ─── CONSTELLATION MAP ────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 920,
          margin: '0 auto',
          padding: `${theme.space.gutter}px ${theme.space.margin}px ${theme.space.hero}px`,
          position: 'relative',
        }}
        aria-label="Destination constellation"
      >
        {/* Subtle starfield background */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(circle at 20% 18%, rgba(217, 168, 92, 0.18) 0%, transparent 0.35%), radial-gradient(circle at 78% 24%, rgba(217, 168, 92, 0.14) 0%, transparent 0.30%), radial-gradient(circle at 45% 60%, rgba(217, 168, 92, 0.10) 0%, transparent 0.25%), radial-gradient(circle at 88% 80%, rgba(217, 168, 92, 0.18) 0%, transparent 0.40%), radial-gradient(circle at 12% 88%, rgba(217, 168, 92, 0.10) 0%, transparent 0.30%)',
            backgroundSize: '600px 800px',
            opacity: 0.6,
          }}
        />

        <Reveal>
          <div
            style={{
              position: 'relative',
              aspectRatio: '4 / 5',
              borderRadius: theme.radius.xl,
              overflow: 'hidden',
              background: `radial-gradient(ellipse at 50% 30%, ${ink.soft} 0%, ${ink.base} 60%, ${ink.deep} 100%)`,
              border: `1px solid rgba(242, 232, 213, 0.08)`,
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.4)',
            }}
          >
            {/* Compass rose top-left */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: 24,
                left: 24,
                fontFamily: theme.font.display,
                fontSize: 11,
                letterSpacing: '0.24em',
                color: ochre.glow,
                opacity: 0.65,
              }}
            >
              N ↑
            </div>
            <div
              aria-hidden
              style={{
                position: 'absolute',
                bottom: 24,
                right: 24,
                fontFamily: theme.font.mono,
                fontSize: 10,
                letterSpacing: '0.14em',
                color: surface.soft,
                opacity: 0.45,
              }}
            >
              28°N · 77°E
            </div>

            {/* SVG layer for lines + pins */}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                overflow: 'visible',
              }}
              aria-hidden
            >
              {/* Connecting filament — a polyline through LINE_ORDER. */}
              <polyline
                points={linePath}
                fill="none"
                stroke={ochre.glow}
                strokeWidth="0.25"
                strokeDasharray="0.5 0.6"
                strokeOpacity={motionPolicy === 'full' ? 0.55 : 0.4}
                style={{
                  filter: 'drop-shadow(0 0 1.2px rgba(217, 168, 92, 0.6))',
                }}
              />

              {/* Pins */}
              {PINS.map((p) => {
                const isHovered = hovered === p.slug;
                return (
                  <g key={p.slug}>
                    {/* Outer ring on hover */}
                    {isHovered && motionPolicy === 'full' && (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="3.4"
                        fill="none"
                        stroke={accent.glow}
                        strokeWidth="0.18"
                        opacity={0.6}
                      />
                    )}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 1.6 : 1.1}
                      fill={accent.base}
                      style={{
                        filter: `drop-shadow(0 0 ${isHovered ? 3 : 1.6}px ${accent.glow})`,
                        transition: 'r 280ms cubic-bezier(0.42, 0, 0.18, 1)',
                      }}
                    />
                    {/* Pulsing inner dot */}
                    <circle cx={p.x} cy={p.y} r="0.5" fill={surface.base} opacity={0.92} />
                  </g>
                );
              })}
            </svg>

            {/* HTML overlay for the pin labels + click targets — easier
                hit-testing + accessibility than SVG */}
            {PINS.map((p) => {
              const isHovered = hovered === p.slug;
              return (
                <Link
                  key={`label-${p.slug}`}
                  href={`/aether/destinations/${p.slug}`}
                  onMouseEnter={() => setHovered(p.slug)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(p.slug)}
                  onBlur={() => setHovered(null)}
                  style={{
                    position: 'absolute',
                    top: `${p.y}%`,
                    left: `${p.x}%`,
                    transform: 'translate(-50%, -50%)',
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    textDecoration: 'none',
                    color: surface.base,
                  }}
                  aria-label={`${p.name}, ${p.state}`}
                >
                  {/* Floating label */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: 30,
                      transform: 'translateX(-50%)',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      opacity: isHovered ? 1 : 0.78,
                      transition: 'opacity 240ms cubic-bezier(0.42, 0, 0.18, 1)',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: theme.font.display,
                        fontSize: 17,
                        fontWeight: 600,
                        letterSpacing: '-0.012em',
                        color: surface.base,
                        textShadow: '0 1px 6px rgba(0, 0, 0, 0.7)',
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      style={{
                        fontFamily: theme.font.ui,
                        fontSize: 9,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: ochre.glow,
                        marginTop: 2,
                        textShadow: '0 1px 4px rgba(0, 0, 0, 0.8)',
                      }}
                    >
                      {p.state}
                    </div>
                  </div>

                  {/* Hover tagline card — anchored above the pin */}
                  {isHovered && (
                    <div
                      style={{
                        position: 'absolute',
                        left: '50%',
                        bottom: 50,
                        transform: 'translateX(-50%)',
                        whiteSpace: 'nowrap',
                        padding: '8px 14px',
                        borderRadius: theme.radius.md,
                        background: 'rgba(242, 232, 213, 0.96)',
                        color: ink.base,
                        fontFamily: theme.font.display,
                        fontStyle: 'italic',
                        fontSize: 13,
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                        pointerEvents: 'none',
                      }}
                    >
                      {p.tagline}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </Reveal>

        {/* Legend strip */}
        <Reveal>
          <div
            style={{
              marginTop: theme.space.loose,
              display: 'flex',
              justifyContent: 'space-between',
              gap: theme.space.comfy,
              flexWrap: 'wrap',
              fontFamily: theme.font.mono,
              fontSize: 11,
              color: surface.soft,
              opacity: 0.6,
            }}
          >
            <span>
              <span style={{ color: accent.glow }}>●</span> six destinations · constellation route
            </span>
            <span>{PINS.length} regions · scale: editorial · last drawn: today</span>
          </div>
        </Reveal>
      </section>

      {/* ─── REGIONS LIST ─────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: `${theme.space.gutter}px ${theme.space.margin}px ${theme.space.hero}px`,
        }}
        aria-labelledby="atlas-list-heading"
      >
        <Reveal>
          <h2
            id="atlas-list-heading"
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(28px, 3vw, 40px)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              fontWeight: 600,
              margin: 0,
              marginBottom: theme.space.loose,
              color: surface.base,
            }}
          >
            Pick a thread to follow
          </h2>
        </Reveal>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {PINS.map((p, idx) => (
            <Reveal key={`row-${p.slug}`} delay={idx * 50}>
              <Link
                href={`/aether/destinations/${p.slug}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 1fr 1fr auto',
                  alignItems: 'baseline',
                  gap: theme.space.comfy,
                  padding: `${theme.space.loose}px 0`,
                  borderBottom: `1px solid rgba(242, 232, 213, 0.08)`,
                  textDecoration: 'none',
                  color: surface.base,
                  transition: 'background 240ms',
                }}
                onMouseEnter={(e) => {
                  if (motionPolicy === 'full') {
                    e.currentTarget.style.background = 'rgba(242, 232, 213, 0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span
                  style={{
                    fontFamily: theme.font.mono,
                    fontSize: 11,
                    letterSpacing: '0.16em',
                    color: olive.soft,
                  }}
                >
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span
                  style={{
                    fontFamily: theme.font.display,
                    fontSize: 'clamp(20px, 2vw, 28px)',
                    lineHeight: 1.2,
                    letterSpacing: '-0.014em',
                    fontWeight: 600,
                  }}
                >
                  {p.name}
                  <span style={{ color: surface.soft, opacity: 0.5, marginLeft: 8 }}>
                    · {p.state}
                  </span>
                </span>
                <span
                  style={{
                    fontFamily: theme.font.display,
                    fontStyle: 'italic',
                    fontSize: theme.text.body.size,
                    color: surface.soft,
                    opacity: 0.78,
                  }}
                >
                  {p.tagline}
                </span>
                <span
                  style={{
                    fontFamily: theme.font.ui,
                    fontSize: theme.text.small.size,
                    fontWeight: 600,
                    color: accent.glow,
                    letterSpacing: '0.02em',
                  }}
                >
                  Explore →
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <EditorialFooter />
    </div>
  );
}

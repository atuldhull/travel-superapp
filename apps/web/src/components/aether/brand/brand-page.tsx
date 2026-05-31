'use client';

/**
 * <BrandPage> — Aether 2.0 press kit + design language reference.
 *
 * Sections:
 *   • Hero — mark + name + tagline.
 *   • Mark — at 18/36/72 px in three colour treatments.
 *   • Palette — Warm Italian core (terracotta · ochre · olive · cream
 *     · espresso) with hex codes + click-to-copy chips.
 *   • Per-destination accents — the 15 curated slug accents (AE61)
 *     as a single strip; useful for partners specifying a city.
 *   • Type — Playfair Display + Inter specimens.
 *
 * Auth-free; public-facing once the env gate flips.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@app/aether-core';
import { DriftNav } from '../drift-nav';
import { Reveal } from '../drift-sections/reveal';
import { EditorialFooter } from '../drift-sections/editorial-footer';
import { useViewport } from '../use-viewport';
import { AetherMark } from '../aether-mark';
import { destinationAccent } from '../destinations/palette';
import { ALL_SLUGS, DESTINATIONS } from '../destinations/data';
// AE334 — shared clipboard helper (was inlined navigator.clipboard).
import { copyTextToClipboard } from '../../../lib/copy-text';

interface PaletteSwatch {
  readonly label: string;
  readonly value: string;
  readonly note: string;
  /** Lighter inks render best on dark swatches and vice-versa. */
  readonly onDark: boolean;
}

const CORE: ReadonlyArray<PaletteSwatch> = [
  { label: 'Terracotta', value: '#C2614A', note: 'accent · CTA · ember', onDark: true },
  { label: 'Terracotta deep', value: '#9A4836', note: 'hover · stroke', onDark: true },
  { label: 'Ochre', value: '#C28A4A', note: 'eyebrow · warning band', onDark: true },
  { label: 'Olive', value: '#6E7B5C', note: 'olive whisper · journal kicker', onDark: true },
  { label: 'Cream', value: '#F2E8D5', note: 'surface · page background', onDark: false },
  { label: 'Cream soft', value: '#E8DDC7', note: 'card · soft surface', onDark: false },
  { label: 'Espresso', value: '#180F0B', note: 'ink · headline · body', onDark: true },
  { label: 'Espresso soft', value: '#5C4A3B', note: 'ink soft · body grey', onDark: true },
];

export function BrandPage(): React.ReactElement {
  const theme = useTheme();
  const { isNarrow } = useViewport();
  const [copied, setCopied] = useState<string | null>(null);

  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;
  const ochre = theme.palette.ochre;
  const olive = theme.palette.olive;

  function copy(text: string): void {
    void copyTextToClipboard(text).then((ok) => {
      if (!ok) return;
      setCopied(text);
      window.setTimeout(() => setCopied(null), 1600);
    });
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
          maxWidth: 1100,
          margin: '0 auto',
          padding: isNarrow
            ? `${theme.space.hero}px ${theme.space.comfy}px ${theme.space.gutter}px`
            : `${theme.space.surface}px ${theme.space.margin}px ${theme.space.hero}px`,
        }}
      >
        {/* ── HERO ────────────────────────────────────────────────── */}
        <Reveal>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.space.comfy,
              marginBottom: theme.space.comfy,
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 56,
                height: 56,
                borderRadius: theme.radius.pill,
                background: accent.base,
                color: surface.base,
              }}
            >
              <AetherMark size={32} />
            </span>
            <p
              style={{
                fontFamily: theme.font.ui,
                fontSize: theme.text.small.size,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: accent.deep,
                fontWeight: 600,
                margin: 0,
              }}
            >
              Brand · design language · press kit
            </p>
          </div>
          <h1
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(44px, 6.4vw, 92px)',
              lineHeight: 1.02,
              letterSpacing: '-0.024em',
              fontWeight: 600,
              margin: 0,
              color: ink.base,
            }}
          >
            Aether at a glance.
          </h1>
          <p
            style={{
              fontFamily: theme.font.display,
              fontStyle: 'italic',
              fontSize: 'clamp(18px, 2vw, 23px)',
              lineHeight: 1.55,
              color: ink.soft,
              margin: `${theme.space.loose}px 0 0`,
              maxWidth: '54ch',
            }}
          >
            The mark, the palette, the type. Copy a hex value, take the SVG, set the road in a
            language we agree on.
          </p>
        </Reveal>

        {/* ── MARK ────────────────────────────────────────────────── */}
        <Reveal>
          <div style={{ marginTop: theme.space.hero }}>
            <p
              style={{
                fontFamily: theme.font.ui,
                fontSize: 11,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: olive.deep,
                fontWeight: 600,
                margin: 0,
                marginBottom: theme.space.tight,
              }}
            >
              01 · the mark
            </p>
            <h2
              style={{
                fontFamily: theme.font.display,
                fontSize: 'clamp(28px, 3.2vw, 40px)',
                lineHeight: 1.1,
                letterSpacing: '-0.018em',
                fontWeight: 600,
                margin: 0,
                marginBottom: theme.space.gutter,
                color: ink.base,
              }}
            >
              Three sizes, three colour treatments.
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: theme.space.comfy,
              }}
            >
              {[
                { label: 'Pill · 18px', bg: accent.base, fg: surface.base, size: 18 },
                { label: 'Outline · 36px', bg: 'transparent', fg: accent.deep, size: 36 },
                { label: 'Reverse · 72px', bg: ink.base, fg: ochre.glow, size: 72 },
              ].map((m) => (
                <div
                  key={m.label}
                  style={{
                    padding: theme.space.loose,
                    borderRadius: theme.radius.lg,
                    background: m.bg,
                    border: `1px solid ${m.bg === 'transparent' ? ink.whisper : 'transparent'}`,
                    color: m.fg,
                    textAlign: 'center',
                  }}
                >
                  <AetherMark size={m.size} title={m.label} />
                  <p
                    style={{
                      marginTop: theme.space.comfy,
                      fontFamily: theme.font.ui,
                      fontSize: 11,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      color: m.fg,
                      opacity: 0.78,
                    }}
                  >
                    {m.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* ── PALETTE ─────────────────────────────────────────────── */}
        <Reveal>
          <div style={{ marginTop: theme.space.hero }}>
            <p
              style={{
                fontFamily: theme.font.ui,
                fontSize: 11,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: olive.deep,
                fontWeight: 600,
                margin: 0,
                marginBottom: theme.space.tight,
              }}
            >
              02 · palette · warm italian
            </p>
            <h2
              style={{
                fontFamily: theme.font.display,
                fontSize: 'clamp(28px, 3.2vw, 40px)',
                lineHeight: 1.1,
                letterSpacing: '-0.018em',
                fontWeight: 600,
                margin: 0,
                marginBottom: theme.space.gutter,
                color: ink.base,
              }}
            >
              The five tones, plus their soft + deep.
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: theme.space.tight,
              }}
            >
              {CORE.map((s) => (
                <button
                  type="button"
                  key={s.value}
                  onClick={() => copy(s.value)}
                  style={{
                    textAlign: 'left',
                    padding: theme.space.loose,
                    borderRadius: theme.radius.lg,
                    background: s.value,
                    border: 'none',
                    color: s.onDark ? surface.base : ink.base,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: theme.space.tight,
                    minHeight: 132,
                    fontFamily: theme.font.ui,
                  }}
                  aria-label={`Copy ${s.label} hex ${s.value}`}
                >
                  <span
                    style={{
                      fontFamily: theme.font.display,
                      fontSize: 22,
                      lineHeight: 1.1,
                      fontWeight: 600,
                      letterSpacing: '-0.012em',
                    }}
                  >
                    {s.label}
                  </span>
                  <span
                    style={{
                      fontFamily: theme.font.mono,
                      fontSize: 13,
                      letterSpacing: '0.04em',
                      opacity: 0.92,
                    }}
                  >
                    {s.value} · {copied === s.value ? '✓ copied' : 'tap to copy'}
                  </span>
                  <span
                    style={{
                      marginTop: 'auto',
                      fontSize: 11,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      opacity: 0.7,
                      fontWeight: 600,
                    }}
                  >
                    {s.note}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        {/* ── PER-DESTINATION ACCENTS ─────────────────────────────── */}
        <Reveal>
          <div style={{ marginTop: theme.space.hero }}>
            <p
              style={{
                fontFamily: theme.font.ui,
                fontSize: 11,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: olive.deep,
                fontWeight: 600,
                margin: 0,
                marginBottom: theme.space.tight,
              }}
            >
              03 · per-destination accents · AE61
            </p>
            <h2
              style={{
                fontFamily: theme.font.display,
                fontSize: 'clamp(28px, 3.2vw, 40px)',
                lineHeight: 1.1,
                letterSpacing: '-0.018em',
                fontWeight: 600,
                margin: 0,
                marginBottom: theme.space.gutter,
                color: ink.base,
              }}
            >
              Fifteen cities, fifteen tones.
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: theme.space.tight,
              }}
            >
              {ALL_SLUGS.map((slug) => {
                const a = destinationAccent(slug);
                const d = DESTINATIONS[slug];
                return (
                  <Link
                    key={slug}
                    href={`/aether/destinations/${slug}`}
                    style={{
                      padding: theme.space.comfy,
                      borderRadius: theme.radius.md,
                      background: a.base,
                      color: surface.base,
                      textDecoration: 'none',
                      display: 'block',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: theme.font.display,
                        fontSize: 18,
                        fontWeight: 600,
                        lineHeight: 1.1,
                      }}
                    >
                      {d?.name ?? slug}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontFamily: theme.font.mono,
                        fontSize: 11,
                        opacity: 0.92,
                      }}
                    >
                      {a.base}
                    </div>
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 10,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        opacity: 0.78,
                      }}
                    >
                      {a.note}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* ── TYPE ───────────────────────────────────────────────── */}
        <Reveal>
          <div style={{ marginTop: theme.space.hero }}>
            <p
              style={{
                fontFamily: theme.font.ui,
                fontSize: 11,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: olive.deep,
                fontWeight: 600,
                margin: 0,
                marginBottom: theme.space.tight,
              }}
            >
              04 · type
            </p>
            <h2
              style={{
                fontFamily: theme.font.display,
                fontSize: 'clamp(28px, 3.2vw, 40px)',
                lineHeight: 1.1,
                letterSpacing: '-0.018em',
                fontWeight: 600,
                margin: 0,
                marginBottom: theme.space.gutter,
                color: ink.base,
              }}
            >
              Playfair for the headline. Inter for the road.
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr',
                gap: theme.space.gutter,
              }}
            >
              <div
                style={{
                  padding: theme.space.loose,
                  borderRadius: theme.radius.lg,
                  border: `1px solid ${ink.whisper}`,
                  background: surface.soft,
                }}
              >
                <p
                  style={{
                    fontFamily: theme.font.ui,
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: ink.soft,
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  Display · Playfair Display
                </p>
                <p
                  style={{
                    fontFamily: theme.font.display,
                    fontSize: 56,
                    lineHeight: 1.0,
                    letterSpacing: '-0.024em',
                    fontWeight: 600,
                    margin: `${theme.space.tight}px 0 0`,
                    color: ink.base,
                  }}
                >
                  Aa
                </p>
                <p
                  style={{
                    fontFamily: theme.font.display,
                    fontSize: 28,
                    lineHeight: 1.1,
                    fontWeight: 600,
                    margin: `${theme.space.tight}px 0 0`,
                    color: ink.base,
                  }}
                >
                  The road, the slow way.
                </p>
                <p
                  style={{
                    fontFamily: theme.font.display,
                    fontStyle: 'italic',
                    fontSize: 19,
                    lineHeight: 1.45,
                    color: ink.soft,
                    margin: `${theme.space.tight}px 0 0`,
                  }}
                >
                  Italic for ledes + pull-quotes — measured, never loud.
                </p>
              </div>
              <div
                style={{
                  padding: theme.space.loose,
                  borderRadius: theme.radius.lg,
                  border: `1px solid ${ink.whisper}`,
                  background: surface.soft,
                }}
              >
                <p
                  style={{
                    fontFamily: theme.font.ui,
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: ink.soft,
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  UI · Inter
                </p>
                <p
                  style={{
                    fontFamily: theme.font.ui,
                    fontSize: 56,
                    lineHeight: 1.0,
                    fontWeight: 600,
                    margin: `${theme.space.tight}px 0 0`,
                    color: ink.base,
                  }}
                >
                  Aa
                </p>
                <p
                  style={{
                    fontFamily: theme.font.ui,
                    fontSize: theme.text.body.size,
                    lineHeight: 1.6,
                    color: ink.base,
                    margin: `${theme.space.tight}px 0 0`,
                  }}
                >
                  The quiet workhorse. Body copy, eyebrows, buttons — Inter does the unglamorous
                  reading.
                </p>
                <p
                  style={{
                    fontFamily: theme.font.mono,
                    fontSize: 13,
                    color: ink.soft,
                    margin: `${theme.space.tight}px 0 0`,
                    letterSpacing: '0.04em',
                  }}
                >
                  Mono · trip · 0123456789
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <EditorialFooter />
    </div>
  );
}

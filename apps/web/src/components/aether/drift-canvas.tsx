'use client';

/**
 * Drift — Aether's home surface, editorial rebuild.
 *
 * Magazine-grade composition: full-bleed Italian photography earning
 * the Warm Italian palette, display-serif headlines, structured below-
 * the-fold sections (Esperienze / Italia da gustare / trust signals).
 *
 * The procedural sun + particle field that lived here in the first
 * Phase 0 cut moved out — they remain in @app/aether-canvas as
 * primitives for transitions / loaders / secondary surfaces, not on
 * the brand hero (a hero on black gives a tech-demo read; this gives
 * a luxury-travel read).
 *
 * Lives inside <AetherProvider> mounted by drift-shell.tsx; reads the
 * Warm Italian theme tokens (no raw hex), uses the locked springs for
 * any interaction, and respects motion + audio policy.
 */
import { useCallback, useEffect } from 'react';
import { useAudioEngine, useMotionPolicy, useTheme } from '@app/aether-core';
import { EXPERIENCES, GUSTARE, HERO, creditUrl, photoUrl } from './photos';

const EXPERIENCE_LABELS: ReadonlyArray<{ title: string; subtitle: string }> = [
  { title: 'Borghi da scoprire', subtitle: 'Piccoli borghi, grandi emozioni.' },
  { title: 'Cucina regionale', subtitle: 'Un viaggio nei sapori locali.' },
  { title: 'Vigneti e cantine', subtitle: 'Degustazioni indimenticabili.' },
  { title: 'Arte e cultura', subtitle: 'Capolavori senza tempo.' },
];

const TRUST_SIGNALS: ReadonlyArray<{ icon: string; title: string; body: string }> = [
  { icon: '◐', title: 'Esperienze autentiche', body: 'Selezionate a mano.' },
  { icon: '⋄', title: 'Supporto locale', body: 'Siamo qui per te.' },
  { icon: '✓', title: 'Prenotazione sicura', body: 'Senza sorprese.' },
  { icon: '♻', title: 'Sostenibilità', body: 'Viaggiamo responsabilmente.' },
];

export function DriftCanvas(): React.ReactElement {
  const theme = useTheme();
  const motionPolicy = useMotionPolicy();
  const { engine, status } = useAudioEngine();

  const handleActivate = useCallback(() => {
    void engine.activate().then(() => engine.startAmbient());
  }, [engine]);

  useEffect(() => {
    return () => engine.stopAmbient();
  }, [engine]);

  // Token-derived inline styles. App code never writes raw hex.
  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;
  const ochre = theme.palette.ochre;
  const olive = theme.palette.olive;

  return (
    <div
      style={{
        background: surface.base,
        color: ink.base,
        fontFamily: theme.font.ui,
        minHeight: '100vh',
      }}
    >
      {/* ─── HERO ─────────────────────────────────────────────────────── */}
      <section
        style={{
          position: 'relative',
          width: '100%',
          height: 'min(92vh, 880px)',
          overflow: 'hidden',
          background: ink.deep,
        }}
        aria-label="Hero"
      >
        {/* Hero photograph */}
        <img
          src={photoUrl(HERO, 2400)}
          alt={HERO.alt}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            // Honor motion policy — no slow ken-burns drift when reduced.
            transform: motionPolicy === 'full' ? 'scale(1.04)' : 'none',
            transformOrigin: '50% 60%',
            transition: 'transform 24s cubic-bezier(0.42, 0, 0.18, 1)',
          }}
        />
        {/* Cream-tinted scrim — preserves photo while lifting palette toward Warm Italian */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(180deg,
              rgba(242, 232, 213, 0.0) 0%,
              rgba(242, 232, 213, 0.12) 45%,
              rgba(42, 30, 24, 0.55) 100%)`,
          }}
          aria-hidden
        />

        {/* Headline column */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            maxWidth: 1280,
            margin: '0 auto',
            padding: `${theme.space.surface}px ${theme.space.margin}px 0`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            height: '100%',
            paddingBottom: theme.space.hero,
            color: surface.base,
          }}
        >
          <p
            style={{
              fontFamily: theme.font.ui,
              fontSize: theme.text.small.size,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: ochre.glow,
              margin: 0,
              marginBottom: theme.space.tight,
            }}
          >
            TravelSuperApp · esperienze italiane
          </p>
          <h1
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(56px, 8vw, 112px)',
              lineHeight: 1.02,
              letterSpacing: '-0.025em',
              fontWeight: theme.text.display.weight,
              margin: 0,
              maxWidth: '12ch',
              textShadow: '0 2px 24px rgba(24, 15, 11, 0.35)',
            }}
          >
            Vivi l'Italia.
          </h1>
          <p
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(22px, 2.4vw, 31px)',
              lineHeight: 1.3,
              letterSpacing: '-0.015em',
              fontStyle: 'italic',
              fontWeight: 400,
              margin: `${theme.space.tight}px 0 ${theme.space.comfy}px`,
              color: surface.soft,
              maxWidth: '32ch',
            }}
          >
            Scopri. Assapora. Ama.
          </p>
          <p
            style={{
              fontFamily: theme.font.ui,
              fontSize: theme.text.large.size,
              lineHeight: 1.55,
              color: surface.soft,
              opacity: 0.92,
              margin: 0,
              marginBottom: theme.space.loose,
              maxWidth: '48ch',
            }}
          >
            Dai borghi nascosti alle città d'arte, vivi esperienze autentiche tra cultura, sapori e
            tradizioni — pianificate da un'intelligenza che capisce il viaggio.
          </p>

          <div style={{ display: 'flex', gap: theme.space.comfy, alignItems: 'center' }}>
            <a
              href="#esperienze"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: `${theme.space.comfy}px ${theme.space.loose}px`,
                borderRadius: theme.radius.pill,
                background: accent.base,
                color: surface.base,
                fontFamily: theme.font.ui,
                fontSize: theme.text.button.size,
                fontWeight: theme.text.button.weight,
                textDecoration: 'none',
                boxShadow: theme.elevation.raised.shadow,
                letterSpacing: '0.01em',
              }}
            >
              Scopri di più
              <span aria-hidden>→</span>
            </a>

            {status === 'awaiting-activation' && (
              <button
                type="button"
                onClick={handleActivate}
                style={{
                  padding: `${theme.space.tight}px ${theme.space.comfy}px`,
                  borderRadius: theme.radius.pill,
                  background: 'rgba(242, 232, 213, 0.12)',
                  border: `1px solid ${surface.whisper}`,
                  color: surface.base,
                  fontFamily: theme.font.ui,
                  fontSize: theme.text.small.size,
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                }}
                aria-label="Attiva l'audio ambientale"
              >
                ◔ audio
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ─── ESPERIENZE ───────────────────────────────────────────────── */}
      <section
        id="esperienze"
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: `${theme.space.surface}px ${theme.space.margin}px`,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: theme.space.hero }}>
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              color: olive.deep,
              fontSize: 24,
              marginBottom: theme.space.tight,
            }}
          >
            ✦
          </span>
          <h2
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(36px, 4.5vw, 56px)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              fontWeight: theme.text.display.weight,
              margin: 0,
              color: ink.base,
            }}
          >
            Le nostre esperienze
          </h2>
          <p
            style={{
              fontFamily: theme.font.ui,
              fontSize: theme.text.large.size,
              color: ink.soft,
              margin: `${theme.space.tight}px 0 0`,
            }}
          >
            Selezioniamo per te il meglio dell'Italia autentica.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: theme.space.loose,
          }}
        >
          {EXPERIENCES.map((photo, idx) => {
            const label = EXPERIENCE_LABELS[idx]!;
            return (
              <article
                key={photo.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: theme.radius.lg,
                  overflow: 'hidden',
                  background: surface.soft,
                  boxShadow: theme.elevation.rest.shadow,
                  border: `1px solid ${ink.whisper}`,
                  transition: 'transform 220ms cubic-bezier(0.42, 0, 0.18, 1), box-shadow 220ms',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (motionPolicy === 'full') {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = theme.elevation.lifted.shadow;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = theme.elevation.rest.shadow;
                }}
              >
                <div
                  style={{
                    aspectRatio: '4 / 3',
                    background: surface.deep,
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={photoUrl(photo, 800)}
                    alt={photo.alt}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    loading="lazy"
                  />
                </div>
                <div style={{ padding: theme.space.comfy }}>
                  <h3
                    style={{
                      fontFamily: theme.font.display,
                      fontSize: theme.text.subhead.size,
                      lineHeight: 1.25,
                      letterSpacing: '-0.01em',
                      fontWeight: 600,
                      margin: 0,
                      color: ink.base,
                    }}
                  >
                    {label.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: theme.font.ui,
                      fontSize: theme.text.small.size,
                      lineHeight: 1.5,
                      color: ink.soft,
                      margin: `${theme.space.hairline}px 0 ${theme.space.comfy}px`,
                    }}
                  >
                    {label.subtitle}
                  </p>
                  <span
                    style={{
                      fontFamily: theme.font.ui,
                      fontSize: theme.text.small.size,
                      fontWeight: 600,
                      color: accent.deep,
                      letterSpacing: '0.02em',
                    }}
                  >
                    Esplora →
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ─── ITALIA DA GUSTARE ────────────────────────────────────────── */}
      <section
        style={{
          position: 'relative',
          width: '100%',
          minHeight: 560,
          overflow: 'hidden',
          background: olive.deep,
        }}
        aria-label="Italia da gustare"
      >
        <img
          src={photoUrl(GUSTARE, 2400)}
          alt={GUSTARE.alt}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.78,
          }}
          loading="lazy"
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(180deg,
              rgba(42, 30, 24, 0.15) 0%,
              rgba(42, 30, 24, 0.55) 100%)`,
          }}
          aria-hidden
        />
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            maxWidth: 1280,
            margin: '0 auto',
            padding: `${theme.space.hero}px ${theme.space.margin}px`,
            color: surface.base,
            textAlign: 'center',
          }}
        >
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              fontSize: 28,
              marginBottom: theme.space.tight,
              color: ochre.glow,
            }}
          >
            ⌑
          </span>
          <h2
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(36px, 4.5vw, 56px)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              margin: 0,
              fontWeight: theme.text.display.weight,
              textShadow: '0 2px 12px rgba(24, 15, 11, 0.35)',
            }}
          >
            Italia da gustare
          </h2>
          <p
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(18px, 2vw, 22px)',
              fontStyle: 'italic',
              lineHeight: 1.5,
              maxWidth: '38ch',
              margin: `${theme.space.comfy}px auto ${theme.space.loose}px`,
              color: surface.soft,
            }}
          >
            Prodotti tipici, ricette tradizionali e storie di chi l'Italia la vive ogni giorno.
          </p>
          <a
            href="#blog"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: `${theme.space.tight}px ${theme.space.loose}px`,
              borderRadius: theme.radius.pill,
              background: surface.base,
              color: ink.base,
              fontFamily: theme.font.ui,
              fontSize: theme.text.button.size,
              fontWeight: theme.text.button.weight,
              textDecoration: 'none',
              boxShadow: theme.elevation.raised.shadow,
            }}
          >
            Scopri il blog
          </a>
        </div>
      </section>

      {/* ─── TRUST SIGNALS ────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: `${theme.space.hero}px ${theme.space.margin}px`,
        }}
        aria-label="Perché TravelSuperApp"
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: theme.space.gutter,
          }}
        >
          {TRUST_SIGNALS.map((s) => (
            <div
              key={s.title}
              style={{
                display: 'flex',
                gap: theme.space.comfy,
                alignItems: 'flex-start',
              }}
            >
              <span
                aria-hidden
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 44,
                  height: 44,
                  borderRadius: theme.radius.pill,
                  background: accent.whisper,
                  color: accent.deep,
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                {s.icon}
              </span>
              <div>
                <h3
                  style={{
                    fontFamily: theme.font.ui,
                    fontSize: theme.text.body.size,
                    fontWeight: 600,
                    margin: 0,
                    color: ink.base,
                  }}
                >
                  {s.title}
                </h3>
                <p
                  style={{
                    fontFamily: theme.font.ui,
                    fontSize: theme.text.small.size,
                    lineHeight: 1.5,
                    color: ink.soft,
                    margin: `${theme.space.hairline}px 0 0`,
                  }}
                >
                  {s.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CREDITS (subtle, bottom) ─────────────────────────────────── */}
      <footer
        style={{
          borderTop: `1px solid ${ink.whisper}`,
          padding: `${theme.space.loose}px ${theme.space.margin}px`,
          fontFamily: theme.font.mono,
          fontSize: 11,
          color: ink.soft,
          textAlign: 'center',
        }}
      >
        Aether · Phase 0 preview · audio: {status} · motion: {motionPolicy}
        <br />
        Photography:{' '}
        {[HERO, ...EXPERIENCES, GUSTARE].map((p, i, arr) => (
          <span key={p.id}>
            <a
              href={creditUrl(p)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: ink.soft, textDecoration: 'underline' }}
            >
              {p.by}
            </a>
            {i < arr.length - 1 ? ' · ' : ''}
          </span>
        ))}{' '}
        on Unsplash. Phase 2 swaps to commissioned editorial.
      </footer>
    </div>
  );
}

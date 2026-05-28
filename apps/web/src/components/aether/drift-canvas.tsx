'use client';

/**
 * Drift hero canvas — Phase 0 prototype.
 *
 * Renders the Aether visual language end-to-end:
 *   • <AetherScene>  — Warm-Italian lighting rig
 *   • <SunDisk>      — gradient hero element (ochre→terracotta)
 *   • <AmbientField> — deterministic dust-motes particles
 *
 * Plus a hero text overlay (display serif over cream surface) and an
 * audio-activation chip (browser autoplay policy requires a user
 * gesture before Tone.js starts).
 *
 * Lives inside <AetherProvider> mounted by the Drift route's page.tsx.
 */
import { useCallback, useEffect, useState } from 'react';
import { AetherScene, AmbientField, SunDisk } from '@app/aether-canvas';
import { useAudioEngine, useTheme } from '@app/aether-core';

export function DriftCanvas(): React.ReactElement {
  const theme = useTheme();
  const { engine, status } = useAudioEngine();
  const [errorAdapter, setErrorAdapter] = useState<string | null>(null);

  const handleActivate = useCallback(() => {
    void engine.activate().then(() => {
      // Start the ambient pad after activation succeeds.
      engine.startAmbient();
    });
  }, [engine]);

  // Stop ambient on unmount.
  useEffect(() => {
    return () => engine.stopAmbient();
  }, [engine]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        minHeight: 600,
        background: theme.color.surface.base,
        color: theme.color.ink.base,
        fontFamily: theme.font.ui,
        overflow: 'hidden',
      }}
    >
      <AetherScene
        ariaLabel="Aether Drift — sun rising over a piazza"
        onRendererReady={(cap) => setErrorAdapter(cap.adapterLabel)}
      >
        <SunDisk />
        <AmbientField count={600} />
      </AetherScene>

      {/* Hero text overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: `${theme.space.surface}px ${theme.space.margin}px ${theme.space.hero}px`,
          pointerEvents: 'none',
        }}
      >
        <p
          style={{
            fontFamily: theme.font.ui,
            fontSize: theme.text.small.size,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: theme.color.ink.soft,
            margin: 0,
            marginBottom: theme.space.tight,
          }}
        >
          Aether · Phase 0 preview
        </p>
        <h1
          style={{
            fontFamily: theme.font.display,
            fontSize: theme.text.display.size,
            lineHeight: theme.text.display.lineHeight,
            letterSpacing: `${theme.text.display.letterSpacing}em`,
            fontWeight: theme.text.display.weight,
            color: theme.color.ink.base,
            margin: 0,
            maxWidth: '14ch',
          }}
        >
          Travel,
          <br />
          rewritten in{' '}
          <em style={{ color: theme.palette.terracotta.deep, fontStyle: 'normal' }}>warm ink</em>.
        </h1>
        <p
          style={{
            fontFamily: theme.font.ui,
            fontSize: theme.text.large.size,
            lineHeight: theme.text.large.lineHeight,
            color: theme.color.ink.soft,
            margin: `${theme.space.comfy}px 0 0`,
            maxWidth: '52ch',
          }}
        >
          A new surface for planning. Calm, tactile, alive. Locked Warm Italian palette · D-minor
          pentatonic · k=120 d=18.
        </p>
      </div>

      {/* Audio activation chip — bottom right, only visible when audio
          is awaiting activation. */}
      {status === 'awaiting-activation' && (
        <button
          type="button"
          onClick={handleActivate}
          style={{
            position: 'absolute',
            right: theme.space.gutter,
            bottom: theme.space.gutter,
            padding: `${theme.space.tight}px ${theme.space.comfy}px`,
            borderRadius: theme.radius.pill,
            border: `1px solid ${theme.color.ink.whisper}`,
            background: theme.palette.terracotta.base,
            color: theme.palette.cream.base,
            fontFamily: theme.font.ui,
            fontSize: theme.text.button.size,
            fontWeight: theme.text.button.weight,
            cursor: 'pointer',
            boxShadow: theme.elevation.raised.shadow,
          }}
        >
          ▸ Enable audio
        </button>
      )}

      {/* Diagnostic chip — renderer + audio status, bottom-left. */}
      <div
        style={{
          position: 'absolute',
          left: theme.space.gutter,
          bottom: theme.space.gutter,
          padding: `${theme.space.hairline}px ${theme.space.tight}px`,
          borderRadius: theme.radius.sm,
          background: theme.palette.cream.whisper,
          color: theme.color.ink.soft,
          fontFamily: theme.font.mono,
          fontSize: theme.text.micro.size,
        }}
      >
        renderer: {errorAdapter ?? 'detecting…'} · audio: {status}
      </div>
    </div>
  );
}

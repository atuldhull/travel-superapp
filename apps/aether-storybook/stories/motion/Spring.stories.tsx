/**
 * Spring story — visualise every named spring as a one-shot animation.
 * Click "play" to re-trigger all springs simultaneously.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useRef, useState } from 'react';
import { springs, type SpringName } from '@app/aether-motion';

interface SpringTrackProps {
  name: SpringName;
  generation: number;
}

function SpringTrack({ name, generation }: SpringTrackProps): React.ReactElement {
  const spring = springs[name];
  const [x, setX] = useState(0);
  const targetRef = useRef(0);
  const velRef = useRef(0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    targetRef.current = 1;
    velRef.current = 0;
    setX(0);
    const tick = (now: number): void => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      // Simple spring integrator: a = -k*(x-target)/m - d*v/m
      setX((cur) => {
        const a =
          (-spring.stiffness * (cur - targetRef.current)) / spring.mass -
          (spring.damping * velRef.current) / spring.mass;
        velRef.current += a * dt;
        return cur + velRef.current * dt;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [name, generation, spring]);

  const pct = Math.min(1, Math.max(0, x));
  return (
    <div style={{ marginBottom: 32 }}>
      <div
        style={{
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: 11,
          color: '#4A352A',
          marginBottom: 8,
        }}
      >
        {name} · k={spring.stiffness} d={spring.damping} m={spring.mass}
      </div>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 36,
          borderRadius: 18,
          background: 'rgba(42, 30, 24, 0.08)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 4,
            left: `calc(${pct * 100}% - 14px)`,
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: '#C2614A',
            boxShadow: '0 2px 6px rgba(42, 30, 24, 0.18)',
          }}
        />
      </div>
    </div>
  );
}

function SpringShowcase(): React.ReactElement {
  const [generation, setGeneration] = useState(0);
  return (
    <div style={{ padding: 48, background: '#F2E8D5', minHeight: '100vh', color: '#2A1E18' }}>
      <h1
        style={{
          fontFamily: 'GT Sectra, Georgia, serif',
          fontSize: 49,
          margin: 0,
          letterSpacing: '-0.025em',
        }}
      >
        Springs
      </h1>
      <p
        style={{
          fontFamily: 'Söhne, system-ui, sans-serif',
          fontSize: 16,
          color: '#4A352A',
          marginTop: 8,
        }}
      >
        Five named springs. `book` is the brand default.
      </p>
      <button
        type="button"
        onClick={() => setGeneration((g) => g + 1)}
        style={{
          marginTop: 16,
          padding: '8px 16px',
          borderRadius: 9999,
          border: 'none',
          background: '#C2614A',
          color: '#F2E8D5',
          fontFamily: 'Söhne, system-ui, sans-serif',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        ▸ Play
      </button>
      <div style={{ marginTop: 48, maxWidth: 720 }}>
        {(Object.keys(springs) as SpringName[]).map((name) => (
          <SpringTrack key={name} name={name} generation={generation} />
        ))}
      </div>
    </div>
  );
}

const meta: Meta<typeof SpringShowcase> = {
  title: 'Motion / Springs',
  component: SpringShowcase,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof SpringShowcase>;
export const FiveSprings: Story = {};

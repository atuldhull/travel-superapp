/**
 * GenieDissolveOverlay story (AE437) — Chromatic baseline for the
 * AE412 particle swarm. Three variants render the swarm at fixed
 * progress points (closed / mid / open) so the SVG layout is
 * comparable across snapshots. The actual rAF transition is exercised
 * by the live overlay; static stories trade animation for diff stability.
 */
import type { Meta, StoryObj } from '@storybook/react';

interface OverlayProps {
  readonly progress: number;
  readonly count: number;
  readonly width: number;
  readonly height: number;
  readonly fill: string;
}

function seedFor(i: number): number {
  return ((i * 0x9e3779b1) ^ ((i + 1) * 0x85ebca77)) >>> 0;
}
function rand(seed: number, salt: number): number {
  let x = (seed + salt * 0x9e3779b1) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return (x % 1_000_000) / 1_000_000;
}
function easeInOutCubic(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function GenieDissolveOverlay({
  progress,
  count,
  width,
  height,
  fill,
}: OverlayProps): React.ReactElement {
  const e = easeInOutCubic(progress);
  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        background: '#1A0F09',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid slice"
      >
        {Array.from({ length: count }, (_, i) => {
          const seed = seedFor(i);
          const sx = rand(seed, 3) * width;
          const sy = rand(seed, 7) * height;
          const cx = width / 2;
          const cy = (height * 2) / 3;
          const baseR = Math.min(width, height) * 0.18;
          const angle = (i / Math.max(1, count)) * Math.PI * 2;
          const rJitter = (rand(seed, 11) - 0.5) * 48;
          const rRing = baseR + rJitter;
          const ex = cx + Math.cos(angle) * rRing;
          const ey = cy + Math.sin(angle) * rRing;
          const x = sx + (ex - sx) * e;
          const y = sy + (ey - sy) * e;
          const rest = 0.35 + rand(seed, 41) * 0.45;
          const opacity = e * rest;
          const r = 2.2 * (0.6 + Math.pow(rand(seed, 17), 3) * 1.6);
          return <circle key={i} cx={x} cy={y} r={r} fill={fill} opacity={opacity} />;
        })}
      </svg>
    </div>
  );
}

const meta: Meta<typeof GenieDissolveOverlay> = {
  title: 'Aether / GenieDissolveOverlay',
  component: GenieDissolveOverlay,
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof GenieDissolveOverlay>;

const COMMON = { count: 120, width: 720, height: 480, fill: '#F2E8D5' } as const;

export const Closed: Story = { args: { ...COMMON, progress: 0 } };
export const Mid: Story = { args: { ...COMMON, progress: 0.5 } };
export const Open: Story = { args: { ...COMMON, progress: 1 } };
export const Sparse: Story = { args: { ...COMMON, count: 40, progress: 1 } };
export const Dense: Story = { args: { ...COMMON, count: 240, progress: 1 } };

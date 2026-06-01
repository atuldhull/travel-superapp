/**
 * LumenPhotoSlot story (AE463) — Chromatic baseline for the AE401
 * Lumen per-asset loader. Storybook is isolated from apps/web so the
 * visuals are re-implemented inline as a flat-square PhotoPlane mock
 * (a div with the resolved photo URL as a background-image, or the
 * Warm Italian palette swatch + asset-id label as the loading /
 * fallback state). Each variant pins one of the slot's three runtime
 * states so the comparison snapshots are deterministic.
 */
import type { Meta, StoryObj } from '@storybook/react';

interface LumenPhotoSlotProps {
  readonly url: string | null;
  readonly size: number;
  readonly assetId: string;
  readonly opacity: number;
  readonly fallbackColor: string;
  readonly borderColor: string;
  readonly label: string;
}

function LumenPhotoSlot({
  url,
  size,
  assetId,
  opacity,
  fallbackColor,
  borderColor,
  label,
}: LumenPhotoSlotProps): React.ReactElement {
  return (
    <div
      data-aether-lumen-photo-slot
      data-aether-asset-id={assetId}
      style={{
        width: size,
        height: size,
        opacity,
        borderRadius: 6,
        border: `1px solid ${borderColor}`,
        background:
          url === null ? fallbackColor : `url(${url}) center / cover no-repeat, ${fallbackColor}`,
        boxShadow: '0 4px 18px rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        padding: 8,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        letterSpacing: '0.06em',
        color: '#F2E8D5',
        textShadow: '0 1px 2px rgba(0, 0, 0, 0.6)',
      }}
    >
      <span>{label}</span>
    </div>
  );
}

const meta: Meta<typeof LumenPhotoSlot> = {
  title: 'Aether / LumenPhotoSlot',
  component: LumenPhotoSlot,
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof LumenPhotoSlot>;

const COMMON = {
  size: 240,
  assetId: 'asset_demo_001',
  opacity: 1,
  fallbackColor: '#E8B777',
  borderColor: '#C2614A',
} as const;

/** disableFetch path — slot renders the palette swatch fallback only. */
export const DisableFetchFallback: Story = {
  args: { ...COMMON, url: null, label: 'fallback (no fetch)' },
};

/** Pending SDK response — same fallback, different label so the
 *  reviewer can scan the two side-by-side. */
export const Loading: Story = {
  args: { ...COMMON, url: null, label: 'loading…' },
};

/** Resolved presigned URL — the texture has loaded. Uses a local
 *  data-URI so Chromatic doesn't hit the network. */
export const Loaded: Story = {
  args: {
    ...COMMON,
    url: 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 fill=%22%23C2614A%22/><circle cx=%2250%22 cy=%2235%22 r=%2218%22 fill=%22%23F2E8D5%22/></svg>',
    label: 'loaded',
  },
};

/** Lifecycle-faded — slot is past its arc so opacity is < 1. */
export const FadedByLifecycle: Story = {
  args: {
    ...COMMON,
    url: 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 fill=%22%23814A2E%22/></svg>',
    opacity: 0.35,
    label: 'opacity 0.35',
  },
};

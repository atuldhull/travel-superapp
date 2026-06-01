/**
 * EchoCard story (AE427) — Chromatic baseline for the AE418-AE420 Echo
 * card + diary overlay. Five variants exercise the dominant-colour
 * palette derivation across the AE418 sample-feed entries.
 */
import type { Meta, StoryObj } from '@storybook/react';

const PHOTOS = {
  leh: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200&q=80',
  goa: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=1200&q=80',
  jaipur:
    'https://images.unsplash.com/photo-1599661046827-dacde6976549?auto=format&fit=crop&w=1200&q=80',
  alleppey:
    'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1200&q=80',
  varanasi:
    'https://images.unsplash.com/photo-1561361398-a8a8e72df96f?auto=format&fit=crop&w=1200&q=80',
};

interface CardProps {
  readonly traveller: string;
  readonly place: string;
  readonly photo: string;
  readonly dominantColor: string;
  readonly diary: string;
  readonly postedLabel: string;
}

/** Approximate AE418 `boostHexColor` — saturates toward the brightest
 *  channel. Storybook can't import from apps/web; reproduce inline. */
function boost(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const max = Math.max(r, g, b);
  if (max === 0) return hex;
  const scale = Math.min(255 / max, factor);
  const c = (x: number): number => Math.max(0, Math.min(255, Math.round(x * scale)));
  return `#${(((c(r) << 16) | (c(g) << 8) | c(b)) >>> 0).toString(16).padStart(6, '0').toUpperCase()}`;
}

function EchoCard({
  traveller,
  place,
  photo,
  dominantColor,
  diary,
  postedLabel,
}: CardProps): React.ReactElement {
  const accent = boost(dominantColor, 1.2);
  const glow = boost(dominantColor, 1.45);
  return (
    <div
      style={{
        position: 'relative',
        width: 460,
        height: 640,
        borderRadius: 22,
        overflow: 'hidden',
        boxShadow: `0 8px 32px ${dominantColor}66`,
        background: '#1A0F09',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <img
        src={photo}
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, rgba(20,12,8,0.0) 0%, rgba(20,12,8,0.55) 70%, rgba(20,12,8,0.85) 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: 24,
          width: 'min(420px, 92%)',
          padding: '18px 22px',
          borderRadius: 18,
          background: 'rgba(20, 12, 8, 0.55)',
          backdropFilter: 'blur(8px)',
          border: `1px solid ${glow}`,
          color: '#F2E8D5',
        }}
      >
        <p
          style={{
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            opacity: 0.78,
            margin: 0,
          }}
        >
          {traveller} · {place} · {postedLabel}
        </p>
        <p
          style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontStyle: 'italic',
            fontSize: 19,
            lineHeight: 1.4,
            margin: '6px 0 0',
            color: '#F2E8D5',
          }}
        >
          “{diary}”
        </p>
      </div>
      <nav
        style={{
          position: 'absolute',
          right: 16,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {['⬆', '➜', '✦'].map((g) => (
          <span
            key={g}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: `1px solid ${accent}`,
              background: 'rgba(20, 12, 8, 0.55)',
              color: '#F2E8D5',
              fontSize: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {g}
          </span>
        ))}
      </nav>
    </div>
  );
}

const meta: Meta<typeof EchoCard> = {
  title: 'Aether / EchoCard',
  component: EchoCard,
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof EchoCard>;

export const Leh: Story = {
  args: {
    traveller: 'Asha Verma',
    place: 'Diskit Monastery',
    photo: PHOTOS.leh,
    dominantColor: '#5C84B4',
    diary: 'The prayer flags above Diskit make the whole valley feel like a held breath.',
    postedLabel: '2h',
  },
};

export const Goa: Story = {
  args: {
    traveller: 'Vikrant K.',
    place: 'Anjuna Cliff Walk',
    photo: PHOTOS.goa,
    dominantColor: '#E8814D',
    diary: 'Sun melts into the Arabian sea while the surf throws orange foam at the basalt.',
    postedLabel: '5h',
  },
};

export const Jaipur: Story = {
  args: {
    traveller: 'Aisha Roy',
    place: 'Jal Mahal courtyard',
    photo: PHOTOS.jaipur,
    dominantColor: '#D6A05F',
    diary: 'Pink walls humming, the courtyard cool by lamplight, and somewhere a sitar starts.',
    postedLabel: '1d',
  },
};

export const Alleppey: Story = {
  args: {
    traveller: 'Maya Iyer',
    place: 'Kuttanad backwaters',
    photo: PHOTOS.alleppey,
    dominantColor: '#5C9B7A',
    diary: 'The houseboat glides past a heron. Coconut palms tip their long bows in the wind.',
    postedLabel: '2d',
  },
};

export const Varanasi: Story = {
  args: {
    traveller: 'Ravi Joshi',
    place: 'Dashashwamedh Ghat',
    photo: PHOTOS.varanasi,
    dominantColor: '#B0644A',
    diary: 'A thousand diyas float at the aarti — saffron, smoke, and the river beneath.',
    postedLabel: '3d',
  },
};

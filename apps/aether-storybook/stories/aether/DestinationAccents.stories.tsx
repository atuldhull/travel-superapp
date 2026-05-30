/**
 * DestinationAccents story (AE78) — Chromatic baseline for the 15
 * curated per-destination accent tones (AE61).
 *
 * The values are duplicated from
 *   apps/web/src/components/aether/destinations/palette.ts
 * so this story is self-contained and any drift between the two
 * lists surfaces in the Chromatic visual diff.
 */
import type { Meta, StoryObj } from '@storybook/react';

interface Accent {
  readonly slug: string;
  readonly name: string;
  readonly base: string;
  readonly deep: string;
  readonly note: string;
}

const ACCENTS: ReadonlyArray<Accent> = [
  { slug: 'jaipur', name: 'Jaipur', base: '#D9805C', deep: '#B0593A', note: 'pink-sandstone' },
  { slug: 'alleppey', name: 'Alleppey', base: '#3F8C7A', deep: '#2B6256', note: 'palm-teal' },
  { slug: 'leh', name: 'Leh', base: '#4F7BAE', deep: '#36578A', note: 'thin-sky' },
  { slug: 'anjuna', name: 'Anjuna', base: '#D88B3F', deep: '#B2682A', note: 'coastal-saffron' },
  { slug: 'hampi', name: 'Hampi', base: '#B57B3E', deep: '#8E5C2A', note: 'granite-gold' },
  { slug: 'varanasi', name: 'Varanasi', base: '#C2624A', deep: '#9A4836', note: 'ghat-ember' },
  { slug: 'mumbai', name: 'Mumbai', base: '#5B8ABF', deep: '#3F6796', note: 'bombay-sea' },
  { slug: 'coorg', name: 'Coorg', base: '#4D7A4A', deep: '#345534', note: 'coffee-canopy' },
  {
    slug: 'pondicherry',
    name: 'Pondicherry',
    base: '#D26A6A',
    deep: '#A14848',
    note: 'french-mustard',
  },
  { slug: 'spiti', name: 'Spiti', base: '#7D7A89', deep: '#56535F', note: 'high-desert' },
  { slug: 'darjeeling', name: 'Darjeeling', base: '#3D8585', deep: '#275D5D', note: 'tea-mist' },
  { slug: 'udaipur', name: 'Udaipur', base: '#C28A4A', deep: '#956A33', note: 'lake-gold' },
  {
    slug: 'madurai',
    name: 'Madurai',
    base: '#B14F4F',
    deep: '#8A3B3B',
    note: 'temple-vermilion',
  },
  { slug: 'bhuj', name: 'Bhuj', base: '#C28438', deep: '#956424', note: 'salt-amber' },
  { slug: 'shillong', name: 'Shillong', base: '#4D6F8B', deep: '#324E66', note: 'cloud-slate' },
];

function Card({ a }: { readonly a: Accent }): React.ReactElement {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        background: a.base,
        color: '#F2E8D5',
        minHeight: 132,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: 'Söhne, system-ui, sans-serif',
      }}
    >
      <div>
        <div style={{ fontFamily: 'GT Sectra, Georgia, serif', fontSize: 22, fontWeight: 600 }}>
          {a.name}
        </div>
        <div
          style={{
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            fontSize: 12,
            opacity: 0.92,
            marginTop: 6,
          }}
        >
          {a.base} · {a.deep}
        </div>
      </div>
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          opacity: 0.78,
          fontWeight: 600,
        }}
      >
        {a.note}
      </div>
    </div>
  );
}

function Showcase(): React.ReactElement {
  return (
    <div
      style={{
        padding: 32,
        background: '#F2E8D5',
        minHeight: '100vh',
        fontFamily: 'Söhne, system-ui, sans-serif',
      }}
    >
      <h1
        style={{
          fontFamily: 'GT Sectra, Georgia, serif',
          fontSize: 49,
          margin: 0,
          color: '#2A1E18',
        }}
      >
        Destination accents
      </h1>
      <p style={{ fontSize: 16, color: '#4A352A', maxWidth: '60ch' }}>
        Fifteen curated tones, one per destination slug. Each accent has a base + deep variant + a
        one-word note. Used as eyebrow + CTA color on each destination page (AE61) and visually keys
        the Atlas pin / list rows / press kit.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginTop: 32,
        }}
      >
        {ACCENTS.map((a) => (
          <Card key={a.slug} a={a} />
        ))}
      </div>
    </div>
  );
}

const meta: Meta<typeof Showcase> = {
  title: 'Aether / DestinationAccents',
  component: Showcase,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof Showcase>;
export const FifteenTones: Story = {};

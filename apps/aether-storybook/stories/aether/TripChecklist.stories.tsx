/**
 * TripChecklist story (AE130) — Chromatic baseline for the editorial
 * checklist card that lives on /aether/journey/[id]. Five static
 * variants exercise the visual states:
 *   • Default starter (5 items, none done)
 *   • Leh-aware starter (6 items: down jacket, Diamox, ILP…)
 *   • Mid-progress (2 done, 3 not)
 *   • All done (line-through + olive halo on every row)
 *   • Undo snackbar visible (AE129)
 *
 * The static rendering bypasses React state + localStorage. The real
 * component lives in apps/web; this story exists purely to lock the
 * visual contract for design review.
 */
import type { Meta, StoryObj } from '@storybook/react';

interface Item {
  readonly text: string;
  readonly done: boolean;
}

interface CardProps {
  readonly title: string;
  readonly items: ReadonlyArray<Item>;
  readonly snackbarText?: string;
}

const COL = {
  cream: '#F2E8D5',
  creamSoft: '#E9DDC2',
  ink: '#180F0B',
  inkSoft: '#5C4A3B',
  inkWhisper: '#D6CBB0',
  terracotta: '#C2614A',
  terracottaDeep: '#9A4836',
  ochreDeep: '#8A5F31',
  ochreGlow: '#D9A66B',
  olive: '#6E7B5C',
  oliveWhisper: '#D9DCC8',
};

function ChecklistCard({ title, items, snackbarText }: CardProps): React.ReactElement {
  const remaining = items.filter((it) => !it.done).length;
  return (
    <div
      style={{
        padding: 24,
        borderRadius: 12,
        background: COL.creamSoft,
        border: `1px solid ${COL.oliveWhisper}`,
        maxWidth: 540,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 16,
        }}
      >
        <p
          style={{
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: COL.ochreDeep,
            fontWeight: 600,
            margin: 0,
          }}
        >
          Checklist · {remaining} left
        </p>
        <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
          <span
            style={{
              fontSize: 11,
              color: COL.inkSoft,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            copy as bullets
          </span>
          <span
            style={{
              fontSize: 11,
              color: COL.inkSoft,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            backup .json
          </span>
          <span
            style={{
              fontSize: 11,
              color: COL.inkSoft,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            reset to starter
          </span>
        </div>
      </div>
      <h3
        style={{
          fontFamily: 'Playfair Display, Georgia, serif',
          fontSize: 28,
          lineHeight: 1.2,
          letterSpacing: '-0.014em',
          fontWeight: 600,
          margin: '6px 0 0',
          color: COL.ink,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontFamily: 'Playfair Display, Georgia, serif',
          fontStyle: 'italic',
          fontSize: 15,
          lineHeight: 1.55,
          color: COL.inkSoft,
          margin: '8px 0 16px',
        }}
      >
        Stays in this browser. Phase 1 wires the list to a real backend so it follows you across
        devices.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
        {items.map((it) => (
          <li
            key={it.text}
            style={{
              display: 'grid',
              gridTemplateColumns: '24px 1fr auto',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 6,
              background: it.done ? COL.oliveWhisper : 'transparent',
            }}
          >
            <input
              type="checkbox"
              checked={it.done}
              readOnly
              style={{ width: 16, height: 16, accentColor: COL.terracotta }}
            />
            <span
              style={{
                fontSize: 14,
                color: it.done ? COL.inkSoft : COL.ink,
                textDecoration: it.done ? 'line-through' : 'none',
              }}
            >
              {it.text}
            </span>
            <span style={{ color: COL.inkSoft, opacity: 0.55, fontSize: 14 }}>×</span>
          </li>
        ))}
      </ul>
      <form style={{ display: 'flex', gap: 8, marginTop: 16 }} onSubmit={(e) => e.preventDefault()}>
        <input
          placeholder="Add one more thing…"
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 999,
            border: `1px solid ${COL.inkWhisper}`,
            background: COL.cream,
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          style={{
            padding: '8px 24px',
            borderRadius: 999,
            background: COL.inkWhisper,
            color: COL.cream,
            border: 'none',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Add
        </button>
      </form>
      {snackbarText !== undefined && (
        <div
          role="status"
          style={{
            marginTop: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '8px 12px',
            borderRadius: 6,
            background: COL.ink,
            color: COL.cream,
            fontSize: 13,
            boxShadow: '0 8px 24px rgba(24, 15, 11, 0.18)',
          }}
        >
          <span>
            Removed{' '}
            <em
              style={{
                fontFamily: 'Playfair Display, Georgia, serif',
                fontStyle: 'italic',
                color: COL.ochreGlow,
              }}
            >
              «{snackbarText}»
            </em>
          </span>
          <span
            style={{
              background: COL.ochreGlow,
              color: COL.ink,
              border: 'none',
              borderRadius: 999,
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Undo
          </span>
        </div>
      )}
    </div>
  );
}

const DEFAULT: ReadonlyArray<Item> = [
  { text: 'Photo ID + photocopy', done: false },
  { text: 'Cash + UPI app working offline', done: false },
  { text: 'Power bank + the right plug', done: false },
  { text: 'A long sleeve for monasteries / temples', done: false },
  { text: 'One book, one notebook', done: false },
];
const LEH: ReadonlyArray<Item> = [
  { text: 'Down jacket + thermal base layer', done: false },
  { text: 'Diamox / altitude pills (consult doctor)', done: false },
  { text: 'Inner Line Permit printouts', done: false },
  { text: 'Lip balm + SPF 50 (UV is brutal at 3500m)', done: false },
  { text: 'Cash — ATMs are sparse beyond town', done: false },
  { text: 'Offline maps + downloaded routes', done: false },
];
const MID: ReadonlyArray<Item> = [
  { text: 'Photo ID + photocopy', done: true },
  { text: 'Cash + UPI app working offline', done: true },
  { text: 'Power bank + the right plug', done: false },
  { text: 'A long sleeve for monasteries / temples', done: false },
  { text: 'One book, one notebook', done: false },
];
const ALL_DONE: ReadonlyArray<Item> = DEFAULT.map((it) => ({ ...it, done: true }));

const meta: Meta<typeof ChecklistCard> = {
  title: 'Aether / TripChecklist',
  component: ChecklistCard,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof ChecklistCard>;

function FullPage(card: React.ReactElement): React.ReactElement {
  return <div style={{ padding: 32, background: COL.cream, minHeight: '100vh' }}>{card}</div>;
}

export const Default: Story = {
  render: () => FullPage(<ChecklistCard title="What to take. What to remember." items={DEFAULT} />),
};

export const LehStarter: Story = {
  render: () => FullPage(<ChecklistCard title="Cold air, thin skies, high passes." items={LEH} />),
};

export const MidProgress: Story = {
  render: () => FullPage(<ChecklistCard title="Two down. Three to go." items={MID} />),
};

export const AllDone: Story = {
  render: () => FullPage(<ChecklistCard title="The bag is packed." items={ALL_DONE} />),
};

export const UndoSnackbarVisible: Story = {
  render: () =>
    FullPage(
      <ChecklistCard
        title="A small mercy."
        items={DEFAULT.slice(0, 4)}
        snackbarText="One book, one notebook"
      />,
    ),
};

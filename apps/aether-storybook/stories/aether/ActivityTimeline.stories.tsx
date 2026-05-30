/**
 * ActivityTimeline story (AE161) — Chromatic baseline for the AE77 /
 * AE128 / AE141 timeline rail. Three variants exercise the visual
 * states:
 *   • Flat — 3 events (no week grouping)
 *   • Eight — exactly at the AE141 threshold; still flat
 *   • WeekGrouped — 11 events, grouped into weeks with olive headers
 *
 * The story is static markup, mirroring the production rail.
 */
import type { Meta, StoryObj } from '@storybook/react';

const COL = {
  cream: '#F2E8D5',
  creamSoft: '#E9DDC2',
  ink: '#180F0B',
  inkSoft: '#5C4A3B',
  terracotta: '#C2614A',
  terracottaDeep: '#9A4836',
  ochreDeep: '#8A5F31',
  ochreGlow: '#D9A66B',
  olive: '#6E7B5C',
  oliveDeep: '#4F5841',
  oliveWhisper: '#D9DCC8',
};

interface Evt {
  readonly at: string;
  readonly label: string;
  readonly kind: 'create' | 'edit' | 'archive' | 'share';
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function Dot({ kind }: { readonly kind: Evt['kind'] }): React.ReactElement {
  const colour =
    kind === 'archive'
      ? COL.ochreDeep
      : kind === 'edit'
        ? COL.oliveDeep
        : kind === 'share'
          ? COL.ochreGlow
          : COL.terracottaDeep;
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        left: -29,
        top: 4,
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: colour,
        boxShadow: `0 0 0 4px ${COL.cream}`,
      }}
    />
  );
}

function Row({ event }: { readonly event: Evt }): React.ReactElement {
  return (
    <li style={{ position: 'relative', padding: '0 0 16px 0' }}>
      <Dot kind={event.kind} />
      <div
        style={{
          fontFamily: 'Playfair Display, Georgia, serif',
          fontSize: 18,
          fontWeight: 600,
          color: COL.ink,
          lineHeight: 1.2,
        }}
      >
        {event.label}
      </div>
      <div
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          color: COL.inkSoft,
          letterSpacing: '0.08em',
          marginTop: 2,
        }}
      >
        {fmtDate(event.at)}
      </div>
    </li>
  );
}

interface ListProps {
  readonly events: ReadonlyArray<Evt>;
  readonly grouped?: boolean;
}

function TimelineRail({ events, grouped }: ListProps): React.ReactElement {
  return (
    <div
      style={{
        background: COL.cream,
        minHeight: '100vh',
        padding: 48,
        fontFamily: 'Inter, system-ui, sans-serif',
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
          marginBottom: 12,
        }}
      >
        This journey&apos;s life so far · {events.length} events
      </p>
      <ol
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          position: 'relative',
          paddingLeft: 22,
          borderLeft: `2px solid ${COL.oliveWhisper}`,
        }}
      >
        {grouped === true ? (
          <GroupedRail events={events} />
        ) : (
          events.map((e) => <Row key={`${e.kind}-${e.at}`} event={e} />)
        )}
      </ol>
    </div>
  );
}

function GroupedRail({ events }: { readonly events: ReadonlyArray<Evt> }): React.ReactElement {
  // Bucket by simple ISO-week (Monday-rooted) for the story.
  const buckets: Array<{ label: string; items: Evt[] }> = [];
  let last: string | null = null;
  for (const e of events) {
    const d = new Date(e.at);
    const day = d.getDay();
    const shift = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + shift);
    const key = monday.toISOString().slice(0, 10);
    if (key !== last) {
      buckets.push({
        label: `Week of ${monday.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })}`,
        items: [],
      });
      last = key;
    }
    buckets[buckets.length - 1]?.items.push(e);
  }
  return (
    <>
      {buckets.map((b, i) => (
        <div key={`wk-${i}`}>
          <li
            aria-hidden
            style={{
              listStyle: 'none',
              position: 'relative',
              padding: '0 0 6px 0',
              marginLeft: -8,
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 10,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: COL.oliveDeep,
              fontWeight: 600,
            }}
          >
            {b.label}
          </li>
          {b.items.map((e) => (
            <Row key={`${e.kind}-${e.at}`} event={e} />
          ))}
        </div>
      ))}
    </>
  );
}

const FLAT_EVENTS: ReadonlyArray<Evt> = [
  { at: '2026-05-30T10:00:00', kind: 'create', label: 'Drafted' },
  { at: '2026-06-02T15:00:00', kind: 'edit', label: 'Edited — version 2' },
  { at: '2026-06-05T20:00:00', kind: 'share', label: 'Shared a link · ab12cd…' },
];

const EIGHT_EVENTS: ReadonlyArray<Evt> = [
  { at: '2026-05-30T10:00:00', kind: 'create', label: 'Drafted' },
  { at: '2026-05-31T10:00:00', kind: 'edit', label: 'Edited — version 2' },
  { at: '2026-06-01T10:00:00', kind: 'edit', label: 'Edited — version 3' },
  { at: '2026-06-02T10:00:00', kind: 'share', label: 'Shared a link · 1a2b3c…' },
  { at: '2026-06-03T10:00:00', kind: 'share', label: 'Shared a link · 4d5e6f…' },
  { at: '2026-06-04T10:00:00', kind: 'edit', label: 'Edited — version 4' },
  { at: '2026-06-05T10:00:00', kind: 'edit', label: 'Edited — version 5' },
  { at: '2026-06-06T10:00:00', kind: 'archive', label: 'Archived' },
];

const ELEVEN_EVENTS: ReadonlyArray<Evt> = [
  { at: '2026-05-25T10:00:00', kind: 'create', label: 'Drafted' },
  { at: '2026-05-26T10:00:00', kind: 'edit', label: 'Edited — version 2' },
  { at: '2026-05-27T10:00:00', kind: 'share', label: 'Shared a link · ab1234…' },
  { at: '2026-06-01T10:00:00', kind: 'edit', label: 'Edited — version 3' },
  { at: '2026-06-02T10:00:00', kind: 'edit', label: 'Edited — version 4' },
  { at: '2026-06-04T10:00:00', kind: 'share', label: 'Shared a link · cd5678…' },
  { at: '2026-06-08T10:00:00', kind: 'edit', label: 'Edited — version 5' },
  { at: '2026-06-09T10:00:00', kind: 'edit', label: 'Edited — version 6' },
  { at: '2026-06-11T10:00:00', kind: 'share', label: 'Shared a link · ef9012…' },
  { at: '2026-06-15T10:00:00', kind: 'edit', label: 'Edited — version 7' },
  { at: '2026-06-18T10:00:00', kind: 'archive', label: 'Archived' },
];

const meta: Meta<typeof TimelineRail> = {
  title: 'Aether / ActivityTimeline',
  component: TimelineRail,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof TimelineRail>;

export const Flat: Story = { args: { events: FLAT_EVENTS } };
export const Eight: Story = { args: { events: EIGHT_EVENTS } };
export const WeekGrouped: Story = { args: { events: ELEVEN_EVENTS, grouped: true } };

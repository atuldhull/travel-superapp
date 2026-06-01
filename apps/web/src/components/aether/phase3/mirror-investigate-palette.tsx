'use client';

/**
 * AE424 — `<MirrorInvestigatePalette>`.
 *
 * Cmd+K (macOS) / Ctrl+K (everywhere else) opens a centered palette
 * over the Mirror surface. The operator types a user id / name; the
 * palette filters `SAMPLE_MIRROR_USERS` in real time. Selecting a
 * suggestion (Enter or click) replaces the search list with the
 * assembled forensic dashboard for that user: trips / reviews /
 * payments / audit-mentions blocks + the summary line + a severity
 * tint on the header.
 *
 * Esc closes the palette. The dashboard view has a "← back to search"
 * affordance to re-open the search.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  filterUserSuggestions,
  formatInvestigationCount,
  highlightRange,
  investigationAnnouncement,
  investigationSeverity,
  isInvestigationHotkey,
  type MirrorInvestigation,
  type MirrorUserSuggestion,
} from './mirror-investigate';
import {
  SAMPLE_MIRROR_INVESTIGATIONS,
  SAMPLE_MIRROR_USERS,
} from './mirror-investigate-sample-data';

export function MirrorInvestigatePalette(): React.ReactElement | null {
  const [open, setOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');
  const [active, setActive] = useState<MirrorInvestigation | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global hotkey listener for Cmd+K / Ctrl+K. Only fires when the
  // event target isn't already typing into another input — otherwise
  // we'd hijack normal keyboard input inside form fields.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      if (open) {
        if (e.key === 'Escape') {
          setOpen(false);
        }
        return;
      }
      if (!isInvestigationHotkey(e)) return;
      // Allow even inside inputs — Cmd+K is universally "search"; the
      // user's intent is unambiguous.
      e.preventDefault();
      setOpen(true);
      setQuery('');
      setActive(null);
      setHoverIndex(0);
      // Suppress unused-tag lint since we may want to inspect it later.
      void tag;
    };
    window.addEventListener('keydown', onKey);
    return (): void => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Auto-focus the input when the palette opens.
  useEffect(() => {
    if (open && active === null) {
      inputRef.current?.focus();
    }
  }, [open, active]);

  const filtered = useMemo<ReadonlyArray<MirrorUserSuggestion>>(
    () => filterUserSuggestions(SAMPLE_MIRROR_USERS, query),
    [query],
  );

  const submitSelection = (id: string): void => {
    const inv = SAMPLE_MIRROR_INVESTIGATIONS[id];
    if (inv !== undefined) setActive(inv);
  };

  if (!open) return null;

  const backdropStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(12, 17, 24, 0.72)',
    backdropFilter: 'blur(8px)',
    zIndex: 80,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: 80,
    fontFamily: 'Inter, system-ui, sans-serif',
  };

  const panelStyle: CSSProperties = {
    width: 'min(640px, 92vw)',
    background: 'var(--aether-palette-ink, #0C1118)',
    border: '1px solid var(--aether-palette-support, #5384B0)',
    borderRadius: 14,
    padding: 0,
    overflow: 'hidden',
    color: 'var(--aether-palette-surface, #E3E6EC)',
    boxShadow: '0 28px 64px rgba(0,0,0,0.6)',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Investigate user"
      data-aether-mirror-investigate
      data-aether-mirror-investigate-mode={active === null ? 'search' : 'dashboard'}
      style={backdropStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <section style={panelStyle}>
        {active === null ? (
          <SearchView
            inputRef={inputRef}
            query={query}
            setQuery={setQuery}
            filtered={filtered}
            hoverIndex={hoverIndex}
            setHoverIndex={setHoverIndex}
            submitSelection={submitSelection}
            onClose={() => setOpen(false)}
          />
        ) : (
          <DashboardView
            active={active}
            onBack={() => setActive(null)}
            onClose={() => setOpen(false)}
          />
        )}
      </section>
      <span
        role="status"
        aria-live="polite"
        data-aether-mirror-investigate-aria
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {investigationAnnouncement(active)}
      </span>
    </div>
  );
}

function SearchView({
  inputRef,
  query,
  setQuery,
  filtered,
  hoverIndex,
  setHoverIndex,
  submitSelection,
  onClose,
}: {
  readonly inputRef: React.RefObject<HTMLInputElement | null>;
  readonly query: string;
  setQuery(q: string): void;
  readonly filtered: ReadonlyArray<MirrorUserSuggestion>;
  readonly hoverIndex: number;
  setHoverIndex(i: number): void;
  submitSelection(id: string): void;
  onClose(): void;
}): React.ReactElement {
  return (
    <div>
      <header
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--aether-palette-support, #5384B0)',
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--aether-palette-glow, #A9C5DE)',
          opacity: 0.7,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>Investigate user · ⌘K</span>
        <button
          type="button"
          aria-label="Close palette"
          onClick={onClose}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      </header>
      <input
        ref={inputRef}
        data-aether-mirror-investigate-input
        type="text"
        placeholder="Search by id, name, or context…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setHoverIndex(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHoverIndex(Math.min(filtered.length - 1, hoverIndex + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHoverIndex(Math.max(0, hoverIndex - 1));
          } else if (e.key === 'Enter') {
            const picked = filtered[hoverIndex];
            if (picked !== undefined) submitSelection(picked.id);
          }
        }}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: '16px 20px',
          color: 'inherit',
          fontSize: 16,
          outline: 'none',
        }}
        autoComplete="off"
      />
      <ul
        data-aether-mirror-investigate-list
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          maxHeight: '50vh',
          overflowY: 'auto',
          borderTop: '1px solid var(--aether-palette-support, #5384B0)',
        }}
      >
        {filtered.length === 0 ? (
          <li
            style={{
              padding: '14px 20px',
              opacity: 0.65,
              fontSize: 13,
            }}
          >
            No users match “{query}”.
          </li>
        ) : (
          filtered.map((s, i) => {
            const highlight = highlightRange(s.displayName, query);
            return (
              <li
                key={s.id}
                data-aether-mirror-investigate-row
                data-aether-mirror-investigate-active={i === hoverIndex}
                onMouseEnter={() => setHoverIndex(i)}
                onClick={() => submitSelection(s.id)}
                style={{
                  padding: '10px 20px',
                  background: i === hoverIndex ? 'rgba(83, 132, 176, 0.18)' : 'transparent',
                  cursor: 'pointer',
                  borderBottom: '1px solid rgba(83, 132, 176, 0.1)',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <span>
                  {highlight === null ? (
                    s.displayName
                  ) : (
                    <>
                      {s.displayName.slice(0, highlight.start)}
                      <mark
                        style={{
                          background: 'transparent',
                          color: 'var(--aether-palette-glow, #A9C5DE)',
                          fontWeight: 700,
                        }}
                      >
                        {s.displayName.slice(highlight.start, highlight.end)}
                      </mark>
                      {s.displayName.slice(highlight.end)}
                    </>
                  )}
                  <span
                    style={{
                      display: 'block',
                      fontSize: 11,
                      opacity: 0.6,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {s.contextTag}
                  </span>
                </span>
                <code
                  style={{
                    fontSize: 11,
                    opacity: 0.5,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  {s.id}
                </code>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function DashboardView({
  active,
  onBack,
  onClose,
}: {
  readonly active: MirrorInvestigation;
  onBack(): void;
  onClose(): void;
}): React.ReactElement {
  const severity = investigationSeverity(active.auditMentions);
  const severityColor =
    severity === 'high'
      ? '#E04A4A'
      : severity === 'medium'
        ? 'var(--aether-palette-glow, #A9C5DE)'
        : 'var(--aether-palette-support, #5384B0)';
  return (
    <div data-aether-mirror-investigate-dashboard>
      <header
        style={{
          padding: '14px 20px',
          borderBottom: `1px solid ${severityColor}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          aria-label="Back to search"
          onClick={onBack}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--aether-palette-glow, #A9C5DE)',
            fontSize: 12,
            cursor: 'pointer',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          ← Back
        </button>
        <span
          data-aether-mirror-investigate-severity={severity}
          style={{
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: severityColor,
            fontWeight: 600,
          }}
        >
          {severity}
        </span>
        <button
          type="button"
          aria-label="Close palette"
          onClick={onClose}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--aether-palette-surface, #E3E6EC)',
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      </header>
      <div style={{ padding: '18px 20px 6px' }}>
        <h2
          data-aether-mirror-investigate-name
          style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontStyle: 'italic',
            fontSize: 24,
            margin: 0,
            color: 'var(--aether-palette-surface, #E3E6EC)',
          }}
        >
          {active.displayName}
        </h2>
        <p
          style={{
            fontSize: 13,
            margin: '4px 0 0',
            opacity: 0.75,
            lineHeight: 1.5,
          }}
        >
          {active.summary}
        </p>
        <code
          style={{
            display: 'block',
            fontSize: 11,
            opacity: 0.55,
            marginTop: 4,
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          {active.userId}
        </code>
      </div>
      <div
        data-aether-mirror-investigate-tiles
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 1,
          margin: '18px 0 0',
          background: 'rgba(83, 132, 176, 0.12)',
        }}
      >
        {[
          { label: 'Trips', value: active.trips },
          { label: 'Reviews', value: active.reviews },
          { label: 'Payments', value: active.payments },
          { label: 'Audit mentions', value: active.auditMentions, severityKey: true as const },
        ].map((tile) => (
          <div
            key={tile.label}
            data-aether-mirror-investigate-tile={tile.label.toLowerCase().replace(/\s+/g, '-')}
            style={{
              padding: '14px 20px',
              background: 'var(--aether-palette-ink, #0C1118)',
            }}
          >
            <span
              style={{
                fontSize: 10,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                opacity: 0.65,
                display: 'block',
              }}
            >
              {tile.label}
            </span>
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 26,
                color: tile.severityKey === true ? severityColor : 'inherit',
                fontWeight: 600,
              }}
            >
              {formatInvestigationCount(tile.value)}
            </span>
          </div>
        ))}
      </div>
      <footer
        style={{
          padding: '12px 20px 16px',
          fontSize: 11,
          opacity: 0.6,
          letterSpacing: '0.04em',
        }}
      >
        Last audit-mention: {active.lastAuditedAt ?? '—'} · backend wiring lands in AE424b.
      </footer>
    </div>
  );
}

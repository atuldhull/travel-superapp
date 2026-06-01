'use client';

/**
 * AE422 — `<MirrorAuditRiver>` audit-log overlay.
 *
 * Right-edge vertical river. Each row is a small floating glyph; the
 * row position is `auditRowYProgress(row, now)` mapped to a top%
 * within the river column. Rows past `MIRROR_AUDIT_RIVER_TTL_MS` fall
 * off via `liveAuditRows`. The hover summary appears as a tooltip
 * below the glyph.
 *
 * The component owns a 1000-ms rAF tick so the rows visibly fall
 * even when the audit set is static; AE422b will swap that tick for
 * a real WebTransport stream once the backend ships.
 */
import { useEffect, useState } from 'react';
import {
  auditGlyphColor,
  auditGlyphSymbol,
  auditRowYProgress,
  liveAuditRows,
  type MirrorAuditRow,
} from './mirror-globe';

export interface MirrorAuditRiverProps {
  readonly rows: ReadonlyArray<MirrorAuditRow>;
  /** Override the tick rate (tests). Defaults to 1 s — coarse enough
   *  to keep paint cheap, fine enough for the river to read as live. */
  readonly tickMs?: number;
}

export function MirrorAuditRiver({
  rows,
  tickMs = 1_000,
}: MirrorAuditRiverProps): React.ReactElement {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), tickMs);
    return (): void => window.clearInterval(id);
  }, [tickMs]);

  const live = liveAuditRows(rows, now);

  return (
    <aside
      data-aether-mirror-audit-river
      aria-label="Audit log river"
      style={{
        position: 'absolute',
        top: 24,
        right: 24,
        width: 280,
        bottom: 24,
        zIndex: 7,
        pointerEvents: 'none',
        fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      <header
        style={{
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--aether-palette-glow, #A9C5DE)',
          opacity: 0.7,
          marginBottom: 8,
        }}
      >
        Audit · live {live.length} / {rows.length}
      </header>
      <div
        data-aether-mirror-audit-rows
        style={{
          position: 'relative',
          height: 'calc(100% - 32px)',
          borderLeft: '1px solid var(--aether-palette-support, #5384B0)',
          paddingLeft: 12,
        }}
      >
        {live.map((row) => {
          const yProgress = auditRowYProgress(row, now);
          const opacity = 1 - yProgress * 0.85;
          const top = `${yProgress * 100}%`;
          return (
            <div
              key={row.id}
              data-aether-mirror-audit-row
              data-aether-mirror-audit-kind={row.kind}
              style={{
                position: 'absolute',
                top,
                left: 0,
                right: 0,
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                opacity,
                color: 'var(--aether-palette-surface, #E3E6EC)',
                fontSize: 11,
                lineHeight: 1.3,
                pointerEvents: 'auto',
              }}
              title={row.summary}
            >
              <span
                aria-hidden
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 3,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: auditGlyphColor(row.kind),
                  color: '#0C1118',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {auditGlyphSymbol(row.kind)}
              </span>
              <span
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {row.summary}
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

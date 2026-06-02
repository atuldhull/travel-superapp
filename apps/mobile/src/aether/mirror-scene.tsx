/**
 * `<AetherMirrorScene/>` — the tenth + final Aether mobile surface, the
 * last Skia one (Phase 4 AE556).
 *
 * Mirror is the admin forensics surface (docs/aether/02-surfaces.md
 * section 9). Per the Phase 4 plan + the locked renderer policy
 * (decision #2), mobile Mirror is **Skia, flat** — the 3D globe + the
 * flowing audit-river overlay are dropped on phone; the audit feed
 * reads as a vertical strip instead.
 *
 * The glyph colours + symbols + the recency fade come from the SAME
 * pure helpers the web Mirror uses — `liveAuditRows` + `auditGlyphColor`
 * + `auditGlyphSymbol` + `auditRowYProgress` from
 * `@app/aether-canvas-shared` (AE421, spec'd at AE502). So a row gets an
 * identical colour + fade on web + mobile.
 *
 * Each row draws its glyph dot in a per-row Skia `<Canvas>` (colour from
 * `auditGlyphColor`, opacity from `1 - auditRowYProgress` so older rows
 * fade) beside an RN text line (symbol + summary + age). The list is
 * filtered to live rows via `liveAuditRows`.
 *
 * Tap a row to expand it (AE578, Round BE): the collapsed row truncates
 * its summary to one line; the expanded row un-truncates the summary +
 * reveals the exact emit time, the kind tag, and the precise age. This
 * is the seventh interactive surface — Mirror is a flat RN list (not
 * R3F), so the interaction is a plain `<Pressable>` toggle, NOT the
 * R3F mesh-tap pattern the depth surfaces share.
 *
 * Real admin data + the role gate (`isMirrorViewer`) land when the
 * admin audit stream is wired (operator-owed); AE556 renders the
 * synthetic `buildSampleAuditRows` feed so the surface demos.
 */
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Canvas, Circle } from '@shopify/react-native-skia';
import {
  auditGlyphColor,
  auditGlyphSymbol,
  auditRowYProgress,
  liveAuditRows,
  type MirrorAuditRow,
} from '@app/aether-canvas-shared';
import { AETHER_ACCENT, AETHER_CREAM, AETHER_INK, AETHER_MUTED, AETHER_SURFACE } from './palette';

const DOT_BOX = 28;
const DOT_BOX_EXPANDED = 40;

export interface AetherMirrorSceneProps {
  /** The audit rows to render. Same shape the web Mirror reads from the
   *  admin audit stream. */
  rows: ReadonlyArray<MirrorAuditRow>;
  /** Clock for the river filter + the recency fade. Defaults to a fixed
   *  value at mount so the fade is stable across re-renders; the route
   *  passes Date.now(). */
  now: number;
}

function ageSeconds(row: MirrorAuditRow, now: number): number | null {
  const t = new Date(row.emittedAt).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((now - t) / 1000));
}

function ageLabel(row: MirrorAuditRow, now: number): string {
  const secs = ageSeconds(row, now);
  return secs === null ? '' : `${secs}s ago`;
}

/** Exact local emit time for the expanded detail. Falls back to the raw
 *  ISO string if it can't be parsed (a malformed feed row). */
function emittedAtLabel(row: MirrorAuditRow): string {
  const t = new Date(row.emittedAt).getTime();
  if (!Number.isFinite(t)) return row.emittedAt;
  return new Date(t).toLocaleTimeString();
}

/**
 * The Mirror surface. A scrollable vertical strip of audit rows, each
 * with a Skia glyph dot + an RN text line. Tap a row to expand it.
 */
export function AetherMirrorScene({ rows, now }: AetherMirrorSceneProps): React.ReactElement {
  const live = useMemo(() => liveAuditRows(rows, now), [rows, now]);
  // Which row is expanded (null = all collapsed). Tapping the open row
  // again collapses it, so the strip never gets "stuck" open.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggle = useCallback(
    (id: string) => setExpandedId((current) => (current === id ? null : id)),
    [],
  );

  return (
    <View style={styles.container} testID="aether-mirror-scene">
      <Text style={styles.heading}>Audit river</Text>
      <Text style={styles.subhead}>
        {live.length} live events · fades after 60s · tap a row for detail
      </Text>
      <ScrollView contentContainerStyle={styles.list}>
        {live.map((row) => {
          const color = auditGlyphColor(row.kind);
          const fade = 1 - auditRowYProgress(row, now);
          const expanded = row.id === expandedId;
          const box = expanded ? DOT_BOX_EXPANDED : DOT_BOX;
          return (
            <Pressable
              key={row.id}
              onPress={() => toggle(row.id)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={`${row.kind} audit event: ${row.summary}`}
              style={({ pressed }) => [
                styles.row,
                expanded && styles.rowExpanded,
                pressed && styles.rowPressed,
              ]}
            >
              <Canvas style={{ width: box, height: box }}>
                <Circle cx={box / 2} cy={box / 2} r={box / 2.6} color={color} opacity={fade} />
              </Canvas>
              <View style={styles.rowText}>
                <Text style={styles.rowSummary} numberOfLines={expanded ? undefined : 1}>
                  <Text style={{ color }}>{auditGlyphSymbol(row.kind)} </Text>
                  {row.summary}
                </Text>
                <Text style={styles.rowMeta}>
                  {row.kind} · {ageLabel(row, now)}
                </Text>
                {expanded ? (
                  <View style={styles.detail}>
                    <DetailLine label="Kind" value={row.kind} />
                    <DetailLine label="Emitted" value={emittedAtLabel(row)} />
                    <DetailLine label="Event ID" value={row.id} />
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
        {live.length === 0 ? (
          <Text style={styles.empty}>No live audit events in the last 60 seconds.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** One label/value pair in the expanded detail block. */
function DetailLine({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <Text style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}: </Text>
      {value}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AETHER_INK,
    paddingTop: 12,
  },
  heading: {
    fontSize: 22,
    fontWeight: '600',
    color: AETHER_CREAM,
    paddingHorizontal: 20,
  },
  subhead: {
    fontSize: 12,
    color: AETHER_MUTED,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: AETHER_SURFACE,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowExpanded: {
    borderColor: AETHER_ACCENT,
    alignItems: 'flex-start',
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowSummary: {
    fontSize: 14,
    color: AETHER_CREAM,
  },
  rowMeta: {
    fontSize: 11,
    color: AETHER_MUTED,
  },
  detail: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AETHER_MUTED,
    gap: 3,
  },
  detailLine: {
    fontSize: 12,
    color: AETHER_CREAM,
  },
  detailLabel: {
    color: AETHER_MUTED,
    fontWeight: '600',
  },
  empty: {
    fontSize: 14,
    color: AETHER_MUTED,
    textAlign: 'center',
    paddingTop: 40,
  },
});

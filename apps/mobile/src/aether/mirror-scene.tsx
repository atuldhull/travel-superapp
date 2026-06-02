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
 * Real admin data + the role gate (`isMirrorViewer`) land when the
 * admin audit stream is wired (operator-owed); AE556 renders the
 * synthetic `buildSampleAuditRows` feed so the surface demos.
 */
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Canvas, Circle } from '@shopify/react-native-skia';
import {
  auditGlyphColor,
  auditGlyphSymbol,
  auditRowYProgress,
  liveAuditRows,
  type MirrorAuditRow,
} from '@app/aether-canvas-shared';

const DOT_BOX = 28;

export interface AetherMirrorSceneProps {
  /** The audit rows to render. Same shape the web Mirror reads from the
   *  admin audit stream. */
  rows: ReadonlyArray<MirrorAuditRow>;
  /** Clock for the river filter + the recency fade. Defaults to a fixed
   *  value at mount so the fade is stable across re-renders; the route
   *  passes Date.now(). */
  now: number;
}

function ageLabel(row: MirrorAuditRow, now: number): string {
  const t = new Date(row.emittedAt).getTime();
  if (!Number.isFinite(t)) return '';
  const secs = Math.max(0, Math.round((now - t) / 1000));
  return `${secs}s ago`;
}

/**
 * The Mirror surface. A scrollable vertical strip of audit rows, each
 * with a Skia glyph dot + an RN text line.
 */
export function AetherMirrorScene({ rows, now }: AetherMirrorSceneProps): React.ReactElement {
  const live = useMemo(() => liveAuditRows(rows, now), [rows, now]);

  return (
    <View style={styles.container} testID="aether-mirror-scene">
      <Text style={styles.heading}>Audit river</Text>
      <Text style={styles.subhead}>{live.length} live events · fades after 60s</Text>
      <ScrollView contentContainerStyle={styles.list}>
        {live.map((row) => {
          const color = auditGlyphColor(row.kind);
          const fade = 1 - auditRowYProgress(row, now);
          return (
            <View key={row.id} style={styles.row}>
              <Canvas style={styles.dotCanvas}>
                <Circle
                  cx={DOT_BOX / 2}
                  cy={DOT_BOX / 2}
                  r={DOT_BOX / 2.6}
                  color={color}
                  opacity={fade}
                />
              </Canvas>
              <View style={styles.rowText}>
                <Text style={styles.rowSummary} numberOfLines={1}>
                  <Text style={{ color }}>{auditGlyphSymbol(row.kind)} </Text>
                  {row.summary}
                </Text>
                <Text style={styles.rowMeta}>
                  {row.kind} · {ageLabel(row, now)}
                </Text>
              </View>
            </View>
          );
        })}
        {live.length === 0 ? (
          <Text style={styles.empty}>No live audit events in the last 60 seconds.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1714',
    paddingTop: 12,
  },
  heading: {
    fontSize: 22,
    fontWeight: '600',
    color: '#F2E8D5',
    paddingHorizontal: 20,
  },
  subhead: {
    fontSize: 12,
    color: '#9B8E7E',
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
    backgroundColor: '#24201C',
  },
  dotCanvas: {
    width: DOT_BOX,
    height: DOT_BOX,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowSummary: {
    fontSize: 14,
    color: '#F2E8D5',
  },
  rowMeta: {
    fontSize: 11,
    color: '#9B8E7E',
  },
  empty: {
    fontSize: 14,
    color: '#9B8E7E',
    textAlign: 'center',
    paddingTop: 40,
  },
});

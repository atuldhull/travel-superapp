'use client';

/**
 * <TripPdfDoc> — printable take-the-road-with-you sheet (AE63).
 *
 * Renders a journey as a calm one-sheet PDF using @react-pdf/renderer.
 * Composition:
 *   • Cover band: terracotta bar with display-serif title + facts
 *   • Body: numbered day cards (matches the journey-dashboard shape)
 *
 * Fonts: we deliberately do NOT register custom fonts at the page
 * level. react-pdf bundles Helvetica + Times-Roman + Courier, which
 * are enough for a one-sheet. Phase 2 swaps to Playfair + Inter via
 * `Font.register({ src: '<url>', family: 'Playfair Display' })` once
 * the licensing posture is signed off.
 */
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type {
  ItineraryDayDto,
  ItineraryItemDto,
  ItineraryListResponseDto,
  TripDto,
} from '@app/sdk';
// AE328 — shared asIso/fmtDate/fmtTime (was duplicated here pre-AE328).
import { asIso, fmtDate, fmtTime as fmtTimeRaw } from '../../../lib/aether-dates';

const COL = {
  cream: '#F2E8D5',
  ink: '#180F0B',
  inkSoft: '#5C4A3B',
  terracotta: '#C2614A',
  terracottaDeep: '#9A4836',
  ochre: '#C28A4A',
  olive: '#6E7B5C',
  hairline: '#D6CBB0',
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: COL.cream,
    color: COL.ink,
    fontFamily: 'Times-Roman',
    fontSize: 11,
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 40,
  },
  cover: {
    backgroundColor: COL.terracotta,
    color: COL.cream,
    paddingVertical: 24,
    paddingHorizontal: 28,
    marginBottom: 24,
  },
  eyebrow: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    letterSpacing: 2,
    color: COL.cream,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'Times-Roman',
    fontSize: 30,
    color: COL.cream,
    lineHeight: 1.05,
    marginBottom: 12,
  },
  factsRow: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 18,
    flexWrap: 'wrap',
  },
  fact: { flexDirection: 'column' },
  factLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    letterSpacing: 1.6,
    color: COL.ochre,
    textTransform: 'uppercase',
  },
  factValue: {
    fontFamily: 'Times-Roman',
    fontSize: 13,
    color: COL.cream,
    marginTop: 1,
  },
  dayRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COL.hairline,
    borderBottomStyle: 'solid',
  },
  dayCap: {
    width: 56,
    fontFamily: 'Times-Roman',
    fontSize: 34,
    lineHeight: 1,
    color: COL.terracottaDeep,
    textAlign: 'right',
    paddingTop: 2,
  },
  dayBody: { flex: 1 },
  dayKicker: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    letterSpacing: 1.4,
    color: COL.inkSoft,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  dayTitle: {
    fontFamily: 'Times-Roman',
    fontSize: 16,
    color: COL.ink,
    lineHeight: 1.15,
    marginBottom: 4,
  },
  daySubtitle: {
    fontFamily: 'Times-Italic',
    fontSize: 10,
    color: COL.inkSoft,
    marginBottom: 6,
    lineHeight: 1.4,
  },
  item: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 3,
  },
  itemTime: {
    width: 60,
    fontFamily: 'Courier',
    fontSize: 8.5,
    color: COL.inkSoft,
  },
  itemText: {
    flex: 1,
    fontFamily: 'Times-Roman',
    fontSize: 10,
    color: COL.ink,
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: COL.inkSoft,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});

// AE328 — local fmtTime wrapper: shared returns string | null but the
// PDF wants a non-null string for every slot. Coalesce to '—'.
function fmtTime(v: unknown): string {
  return fmtTimeRaw(v) ?? '—';
}

function readSummaryField(
  summary: ItineraryDayDto['summary'],
  key: 'title' | 'subtitle' | 'theme' | 'note',
): string | null {
  if (summary === null) return null;
  const v = (summary as Record<string, unknown>)[key];
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}

export interface TripPdfDocProps {
  readonly trip: TripDto;
  readonly itinerary: ItineraryListResponseDto | null;
}

export function TripPdfDoc({ trip, itinerary }: TripPdfDocProps): React.ReactElement {
  const days = itinerary?.days ?? [];
  const range =
    asIso(trip.startsOn) !== null && asIso(trip.endsOn) !== null
      ? `${fmtDate(trip.startsOn)} → ${fmtDate(trip.endsOn)}`
      : '—';
  const generated = new Date().toLocaleString();
  return (
    <Document
      title={`Aether — ${trip.title}`}
      author="TravelSuperApp · Aether"
      subject={`Trip ${trip.id}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.cover}>
          <Text style={styles.eyebrow}>Aether · Your journey</Text>
          <Text style={styles.title}>{trip.title}</Text>
          <View style={styles.factsRow}>
            <View style={styles.fact}>
              <Text style={styles.factLabel}>Range</Text>
              <Text style={styles.factValue}>{range}</Text>
            </View>
            <View style={styles.fact}>
              <Text style={styles.factLabel}>Status</Text>
              <Text style={styles.factValue}>{trip.status}</Text>
            </View>
            <View style={styles.fact}>
              <Text style={styles.factLabel}>Radius</Text>
              <Text style={styles.factValue}>{trip.radiusKm} km</Text>
            </View>
            <View style={styles.fact}>
              <Text style={styles.factLabel}>Days</Text>
              <Text style={styles.factValue}>{days.length || '—'}</Text>
            </View>
          </View>
        </View>

        {days.length === 0 ? (
          <View>
            <Text style={styles.dayTitle}>The intelligence is preparing your itinerary.</Text>
            <Text style={styles.daySubtitle}>
              Open this journey in the planner to read the day-by-day; this sheet shows the shape.
            </Text>
          </View>
        ) : (
          days.map((day) => {
            const num = day.dayIndex + 1;
            const title = readSummaryField(day.summary, 'title') ?? 'A quiet day in the journey.';
            const subtitle =
              readSummaryField(day.summary, 'subtitle') ?? readSummaryField(day.summary, 'theme');
            const items = [...day.items].sort(
              (a: ItineraryItemDto, b: ItineraryItemDto) => a.position - b.position,
            );
            return (
              <View key={day.id} style={styles.dayRow} wrap={false}>
                <Text style={styles.dayCap}>{String(num).padStart(2, '0')}</Text>
                <View style={styles.dayBody}>
                  <Text style={styles.dayKicker}>
                    Day {num} · {fmtDate(day.date)}
                  </Text>
                  <Text style={styles.dayTitle}>{title}</Text>
                  {subtitle !== null && <Text style={styles.daySubtitle}>{subtitle}</Text>}
                  {items.map((item) => {
                    const start = fmtTime(item.startTime);
                    const end = fmtTime(item.endTime);
                    const noteText = asIso(item.notes);
                    const timeStr =
                      start === '—' && end === '—'
                        ? '—'
                        : end === '—'
                          ? start
                          : `${start} · ${end}`;
                    return (
                      <View key={item.id} style={styles.item}>
                        <Text style={styles.itemTime}>{timeStr}</Text>
                        <Text style={styles.itemText}>
                          {noteText ?? 'Movement, with no script.'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}

        <View style={styles.footer} fixed>
          <Text>TravelSuperApp · Aether</Text>
          <Text>
            Generated {generated} · trip {trip.id.slice(0, 8)}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/**
 * V.UX.22 — etiquette card for the cultural / religious traveler.
 * Pure presentational shell that renders only when the place's
 * `metadata` carries `etiquette` or `dressCode` strings (the
 * V.UX.22 schema convention). Otherwise renders nothing — caller
 * doesn't need to gate.
 *
 * `venueType` (temple / mosque / church / shrine / synagogue / ...)
 * picks the icon. Fallback is 🛕 so a generic "cultural site" still
 * gets a visual anchor.
 *
 * Installed by prompt [V.UX.22].
 */
'use client';

interface PlaceLikeMetadata {
  readonly etiquette?: unknown;
  readonly dressCode?: unknown;
  readonly venueType?: unknown;
}

interface EtiquetteCardProps {
  readonly placeName?: string;
  readonly metadata: PlaceLikeMetadata | null | undefined;
}

const VENUE_ICON: Record<string, string> = {
  temple: '🛕',
  mosque: '🕌',
  church: '⛪',
  synagogue: '🕍',
  shrine: '⛩️',
  monastery: '🛕',
};

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

export function EtiquetteCard({ placeName, metadata }: EtiquetteCardProps) {
  const etiquette = asString(metadata?.etiquette);
  const dressCode = asString(metadata?.dressCode);
  const venueType = asString(metadata?.venueType)?.toLowerCase() ?? '';
  if (!etiquette && !dressCode) return null;

  const icon = VENUE_ICON[venueType] ?? '🛕';
  return (
    <aside
      className="rounded-md border border-violet-500/40 bg-violet-500/5 p-3 text-sm shadow-sm"
      aria-label={
        placeName ? `Cultural etiquette for ${placeName}` : 'Cultural etiquette and dress code'
      }
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
        {icon} Cultural etiquette
        {placeName ? <span className="ml-1 text-muted">— {placeName}</span> : null}
      </p>
      {dressCode ? (
        <p className="mt-1 text-xs">
          <span className="font-semibold">👗 Dress code:</span> {dressCode}
        </p>
      ) : null}
      {etiquette ? (
        <p className="mt-1 text-xs leading-relaxed">
          <span className="font-semibold">🙏 Etiquette:</span> {etiquette}
        </p>
      ) : null}
    </aside>
  );
}

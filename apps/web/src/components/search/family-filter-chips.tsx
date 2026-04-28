/**
 * V.UX.14 — family-mode filter chips. When the user has flipped
 * `Preferences.familyMode = true`, this row of toggleable chips
 * appears above any search form (places + stays). Selected chips
 * map directly to the API filter:
 *
 *   places:  requiredFeatures: ['kid_friendly', 'stroller_accessible']
 *   stays:   requiredAmenities: ['high_chair', 'crib']
 *
 * The component is presentational + controlled — parent owns the
 * selected set so it can route the chip values into the right
 * search payload.
 *
 * Installed by prompt [V.UX.14].
 */
'use client';

export type FamilyChipKey = 'kid_friendly' | 'stroller_accessible' | 'high_chair' | 'crib';

interface ChipDef {
  readonly key: FamilyChipKey;
  readonly label: string;
  readonly icon: string;
  readonly hint: string;
}

export const FAMILY_CHIPS: readonly ChipDef[] = [
  {
    key: 'kid_friendly',
    label: 'Kid-friendly',
    icon: '👶',
    hint: 'Activities + venues OK with kids',
  },
  {
    key: 'stroller_accessible',
    label: 'Stroller-accessible',
    icon: '🚼',
    hint: 'Step-free entry / wide aisles',
  },
  { key: 'high_chair', label: 'High chairs', icon: '🍽️', hint: 'Eateries with high chairs' },
  { key: 'crib', label: 'Cribs', icon: '🛏️', hint: 'Stays that provide a crib' },
];

export interface FamilyFilterChipsProps {
  readonly selected: ReadonlySet<FamilyChipKey>;
  readonly onChange: (next: ReadonlySet<FamilyChipKey>) => void;
  readonly autoFromFamilyMode?: boolean;
}

export function FamilyFilterChips({
  selected,
  onChange,
  autoFromFamilyMode,
}: FamilyFilterChipsProps) {
  function toggle(key: FamilyChipKey) {
    const next = new Set(selected);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(next);
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {autoFromFamilyMode ? (
        <span className="mr-1 text-[10px] uppercase tracking-wider text-muted">👨‍👩‍👧 Family mode</span>
      ) : null}
      {FAMILY_CHIPS.map((c) => {
        const on = selected.has(c.key);
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => toggle(c.key)}
            aria-pressed={on}
            title={c.hint}
            className={[
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition',
              on
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-muted/30 text-muted hover:border-muted/50 hover:bg-muted/10',
            ].join(' ')}
          >
            <span aria-hidden="true">{c.icon}</span>
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

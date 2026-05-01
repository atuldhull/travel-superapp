/**
 * V.UX.25 — badge shelf for the public reviewer profile. Renders
 * the badge slug list as labelled chips. Mapping table is local so
 * new badges land without a backend round-trip; unknown slugs fall
 * through with a generic 🏅 + the raw key.
 *
 * Installed by prompt [V.UX.25].
 */
'use client';

interface BadgeShelfProps {
  readonly badges: readonly string[];
  readonly className?: string;
}

interface BadgeMeta {
  readonly icon: string;
  readonly label: string;
}

const BADGE_META: Readonly<Record<string, BadgeMeta>> = {
  contributor_1: { icon: '✍️', label: 'First review' },
  contributor_10: { icon: '✍️', label: '10 reviews' },
  contributor_100: { icon: '🏆', label: '100 reviews' },
  helpful_10: { icon: '👍', label: '10 helpful votes' },
  helpful_100: { icon: '🌟', label: '100 helpful votes' },
};

export function BadgeShelf({ badges, className }: BadgeShelfProps) {
  if (badges.length === 0) {
    return (
      <p className={`text-xs text-muted ${className ?? ''}`}>
        No badges yet — write a review or get a helpful vote to earn the first one.
      </p>
    );
  }
  return (
    <ul className={`flex flex-wrap gap-2 ${className ?? ''}`}>
      {badges.map((slug) => {
        const meta = BADGE_META[slug] ?? { icon: '🏅', label: slug };
        return (
          <li
            key={slug}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-300"
            title={slug}
          >
            <span aria-hidden="true">{meta.icon}</span>
            <span>{meta.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

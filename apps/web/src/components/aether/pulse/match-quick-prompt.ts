/**
 * AE261 — pure router for the AE19 Pulse quick-prompt chips.
 *
 * Today pulse.tsx hard-codes 4 chips ('Plan a trip', 'Your
 * journeys', 'Find a destination', 'See the map') each with its
 * own href. This helper canonicalises the routing so a fifth
 * chip lands in one place.
 *
 * Returns the canonical href + kind for a label match, or null
 * if the label isn't a known quick-prompt.
 */

export type QuickPromptKind = 'plan' | 'mine' | 'find' | 'map';

export interface QuickPromptRoute {
  readonly kind: QuickPromptKind;
  readonly href: string;
}

const QUICK_PROMPT_ROUTES: ReadonlyArray<{ label: string; kind: QuickPromptKind; href: string }> = [
  { label: 'Plan a trip', kind: 'plan', href: '/aether/plan' },
  { label: 'Your journeys', kind: 'mine', href: '/aether/me/journeys' },
  { label: 'Find a destination', kind: 'find', href: '/aether/destinations' },
  { label: 'See the map', kind: 'map', href: '/aether/atlas' },
];

export function quickPrompts(): ReadonlyArray<QuickPromptRoute & { label: string }> {
  return QUICK_PROMPT_ROUTES;
}

export function matchQuickPrompt(label: string): QuickPromptRoute | null {
  const target = label.trim().toLowerCase();
  if (target === '') return null;
  for (const r of QUICK_PROMPT_ROUTES) {
    if (r.label.toLowerCase() === target) {
      return { kind: r.kind, href: r.href };
    }
  }
  return null;
}

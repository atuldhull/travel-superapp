/**
 * AE231 — pure mapping from chat message role → visual contract
 * (alignment + bubble accent token) for the Pulse drawer.
 *
 * Today pulse.tsx ternaries `m.role === 'user' ? right : left` and
 * `m.role === 'user' ? accent : ink.whisper` inline. This helper
 * canonicalises:
 *
 *   roleVisuals(role) → { align, accentKey }
 *
 * `accentKey` is a stable string token ('user-accent' / 'assistant-
 * whisper') so a future palette refactor changes one mapping table
 * instead of every Pulse render path.
 */

export type ChatRole = 'user' | 'assistant';

export interface RoleVisuals {
  readonly align: 'left' | 'right';
  readonly accentKey: 'user-accent' | 'assistant-whisper';
  /** Convenience: which font-weight reads as primary for this role. */
  readonly weight: 400 | 500;
}

const VIS_USER: RoleVisuals = {
  align: 'right',
  accentKey: 'user-accent',
  weight: 500,
};

const VIS_ASSISTANT: RoleVisuals = {
  align: 'left',
  accentKey: 'assistant-whisper',
  weight: 400,
};

export function roleVisuals(role: ChatRole): RoleVisuals {
  return role === 'user' ? VIS_USER : VIS_ASSISTANT;
}

/**
 * AE345 — pure {role, theme} → CSS bubble style for Pulse messages.
 *
 * Previously a wall of `role === 'user' ? X : Y` ternaries inside
 * pulse.tsx (8 visual axes per render). Lifting the mapping centres
 * the design contract — a future change to e.g. assistant bubble
 * background lands in one spot, and the spec tells future devs
 * exactly which axes Pulse cares about per role.
 *
 * `theme` is structurally typed (the few palette fields we read)
 * instead of `Theme` from `@app/aether-core` so the spec can pass a
 * tiny fixture without spinning up the provider.
 *
 * Returns a React.CSSProperties subset — the consumer spreads it into
 * a JSX style block.
 */
import type { CSSProperties } from 'react';

export type ChatRole = 'user' | 'assistant';

export interface BubbleThemeInputs {
  readonly color: {
    readonly surface: { readonly base: string };
    readonly ink: { readonly base: string; readonly whisper: string };
  };
  readonly palette: {
    readonly terracotta: { readonly base: string };
  };
  readonly font: {
    readonly ui: string;
    readonly display: string;
  };
  readonly text: {
    readonly small: { readonly size: number };
  };
}

/** Pulse user-bubble shadow. Hard-coded RGBA per AE19 (terracotta with
 *  25% alpha) — pulled out so the spec can lock the contract. */
export const USER_BUBBLE_SHADOW = '0 2px 8px rgba(194, 97, 74, 0.25)';

export function pulseMessageBubbleStyle(role: ChatRole, theme: BubbleThemeInputs): CSSProperties {
  const isUser = role === 'user';
  return {
    alignSelf: isUser ? 'flex-end' : 'flex-start',
    background: isUser ? theme.palette.terracotta.base : theme.color.surface.base,
    color: isUser ? theme.color.surface.base : theme.color.ink.base,
    fontFamily: isUser ? theme.font.ui : theme.font.display,
    fontSize: isUser ? theme.text.small.size : 14,
    lineHeight: isUser ? 1.5 : 1.6,
    border: isUser ? 'none' : `1px solid ${theme.color.ink.whisper}`,
    boxShadow: isUser ? USER_BUBBLE_SHADOW : 'none',
  };
}

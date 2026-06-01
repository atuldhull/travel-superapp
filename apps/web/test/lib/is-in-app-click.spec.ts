/**
 * Vitest specs for the AE461 `isInAppClick` helper.
 *
 * Edge cases:
 *   • primary button only (0 → true, 1 / 2 → false)
 *   • each of the four modifier keys (meta / ctrl / shift / alt) → false
 *   • target attribute: missing / '' / '_self' → true; '_blank' / '_top'
 *     / '_parent' / named frame → false; case-insensitive
 *   • defaultPrevented short-circuits to false
 */
import { describe, expect, it } from 'vitest';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { isInAppClick } from '../../src/components/aether/phase1/is-in-app-click';

interface FakeAnchorClick {
  readonly button: number;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly defaultPrevented: boolean;
  readonly target: string | null;
}

function makeEvent(over: Partial<FakeAnchorClick> = {}): ReactMouseEvent<HTMLAnchorElement> {
  const opts: FakeAnchorClick = {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    target: null,
    ...over,
  };
  const currentTarget = {
    getAttribute(name: string): string | null {
      if (name === 'target') return opts.target;
      return null;
    },
  };
  return {
    button: opts.button,
    metaKey: opts.metaKey,
    ctrlKey: opts.ctrlKey,
    shiftKey: opts.shiftKey,
    altKey: opts.altKey,
    defaultPrevented: opts.defaultPrevented,
    currentTarget,
  } as unknown as ReactMouseEvent<HTMLAnchorElement>;
}

describe('isInAppClick', () => {
  it('returns true for a primary-button click with no modifiers and no target', () => {
    expect(isInAppClick(makeEvent())).toBe(true);
  });

  it('returns false for a right-button click (button=2)', () => {
    expect(isInAppClick(makeEvent({ button: 2 }))).toBe(false);
  });

  it('returns false for a middle-button click (button=1)', () => {
    expect(isInAppClick(makeEvent({ button: 1 }))).toBe(false);
  });

  it('returns false when Cmd (metaKey) is held', () => {
    expect(isInAppClick(makeEvent({ metaKey: true }))).toBe(false);
  });

  it('returns false when Ctrl is held', () => {
    expect(isInAppClick(makeEvent({ ctrlKey: true }))).toBe(false);
  });

  it('returns false when Shift is held', () => {
    expect(isInAppClick(makeEvent({ shiftKey: true }))).toBe(false);
  });

  it('returns false when Alt is held', () => {
    expect(isInAppClick(makeEvent({ altKey: true }))).toBe(false);
  });

  it("returns false for target='_blank'", () => {
    expect(isInAppClick(makeEvent({ target: '_blank' }))).toBe(false);
  });

  it("returns true for target='_self'", () => {
    expect(isInAppClick(makeEvent({ target: '_self' }))).toBe(true);
  });

  it('returns true for an empty-string target attribute', () => {
    expect(isInAppClick(makeEvent({ target: '' }))).toBe(true);
  });

  it("is case-insensitive for target ('_BLANK' still rejects)", () => {
    expect(isInAppClick(makeEvent({ target: '_BLANK' }))).toBe(false);
  });

  it("is case-insensitive for target ('_Self' still accepts)", () => {
    expect(isInAppClick(makeEvent({ target: '_Self' }))).toBe(true);
  });

  it("returns false for any non-_self named target (e.g. '_top', '_parent', 'mywindow')", () => {
    expect(isInAppClick(makeEvent({ target: '_top' }))).toBe(false);
    expect(isInAppClick(makeEvent({ target: '_parent' }))).toBe(false);
    expect(isInAppClick(makeEvent({ target: 'mywindow' }))).toBe(false);
  });

  it('returns false when defaultPrevented is already true (Next Link handled it)', () => {
    expect(isInAppClick(makeEvent({ defaultPrevented: true }))).toBe(false);
  });

  it('returns false when defaultPrevented and a modifier are both set (short-circuit)', () => {
    expect(isInAppClick(makeEvent({ defaultPrevented: true, metaKey: true }))).toBe(false);
  });

  it('treats every modifier independently (Ctrl+Shift still rejects)', () => {
    expect(isInAppClick(makeEvent({ ctrlKey: true, shiftKey: true }))).toBe(false);
  });
});

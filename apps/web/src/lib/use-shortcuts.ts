/**
 * V.UX.29 — global keyboard-shortcut primitives.
 *
 *   - `useShortcut(spec, handler)` — registers a single binding for
 *     the lifetime of the component. Auto-skips when the user is
 *     typing in an input / textarea / contenteditable element so we
 *     don't hijack characters they meant to type.
 *
 *   - `useShortcuts(map)` — sugar for binding several handlers in
 *     one go. Each entry is `'k': () => fn`.
 *
 * Spec syntax: lowercase letter or symbol, optionally prefixed with
 * `mod+` (Cmd on macOS, Ctrl on Win/Linux). Examples: `'k'`,
 * `'mod+k'`, `'?'`, `'shift+?'`.
 *
 * `mod+` matches `event.metaKey || event.ctrlKey` so the same
 * binding works on macOS + Windows without forking by platform.
 *
 * Installed by prompt [V.UX.29].
 */
import { useEffect } from 'react';

interface ParsedSpec {
  readonly key: string;
  readonly needsMod: boolean;
  readonly needsShift: boolean;
}

function parseSpec(spec: string): ParsedSpec {
  const parts = spec.toLowerCase().split('+');
  const key = parts[parts.length - 1] ?? '';
  return {
    key,
    needsMod: parts.includes('mod') || parts.includes('cmd') || parts.includes('ctrl'),
    needsShift: parts.includes('shift'),
  };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export type ShortcutHandler = (event: KeyboardEvent) => void;

export interface ShortcutOptions {
  /** Allow firing even when an input is focused. Use sparingly —
   *  the palette's mod+k binding sets this so power users can
   *  invoke it from anywhere. Default: false. */
  readonly allowInInput?: boolean;
  /** Disable the binding without unmounting. */
  readonly enabled?: boolean;
}

export function useShortcut(
  spec: string,
  handler: ShortcutHandler,
  options: ShortcutOptions = {},
): void {
  const allowInInput = options.allowInInput ?? false;
  const enabled = options.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;
    const parsed = parseSpec(spec);
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      const mod = e.metaKey || e.ctrlKey;
      if (parsed.needsMod !== mod) return;
      if (parsed.needsShift !== e.shiftKey) return;
      // Comparing on `e.key.toLowerCase()` so 'shift+/' captures '?'
      // (which `key` reports as '?' on shifted '/') and plain 'k'
      // captures 'K' if Caps is on.
      if (e.key.toLowerCase() !== parsed.key) return;
      if (!allowInInput && isTypingTarget(e.target)) return;
      handler(e);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spec, handler, allowInInput, enabled]);
}

export function useShortcuts(
  map: Readonly<Record<string, ShortcutHandler>>,
  options: ShortcutOptions = {},
): void {
  // Iterate at hook-definition time so the dep array is stable.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  for (const spec of Object.keys(map)) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useShortcut(spec, map[spec]!, options);
  }
}

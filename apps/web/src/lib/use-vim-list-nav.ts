/**
 * V.UX.29 — vim-style j/k focus navigation across a flat list of
 * focusable elements within a container.
 *
 * Usage: attach `containerRef` to the list root, mark each focusable
 * row with the same `itemSelector` (default `[data-vim-item]` — a
 * `tabindex={0}` anchor, button, or div). The hook wires a global
 * keydown handler:
 *
 *   - `j` → focus next item.
 *   - `k` → focus previous item.
 *   - `g` then `g` → focus first.
 *   - `G` (shift+g) → focus last.
 *   - `Enter` on a focused item triggers the element's native click.
 *
 * Skips when the user is typing in a text input. The shortcut is
 * scoped to the page that mounts this hook — unmount removes the
 * handler.
 *
 * Installed by prompt [V.UX.29].
 */
import { useEffect, useRef, type RefObject } from 'react';

interface VimListOptions {
  readonly itemSelector?: string;
  readonly enabled?: boolean;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useVimListNav(
  containerRef: RefObject<HTMLElement | null>,
  options: VimListOptions = {},
): void {
  const itemSelector = options.itemSelector ?? '[data-vim-item]';
  const enabled = options.enabled ?? true;
  const lastG = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    function items(): HTMLElement[] {
      const root = containerRef.current;
      if (!root) return [];
      return Array.from(root.querySelectorAll<HTMLElement>(itemSelector));
    }
    function activeIdx(list: HTMLElement[]): number {
      const a = document.activeElement as HTMLElement | null;
      return a ? list.indexOf(a) : -1;
    }
    function focusAt(list: HTMLElement[], idx: number) {
      const clamped = Math.max(0, Math.min(list.length - 1, idx));
      list[clamped]?.focus();
    }
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      const list = items();
      if (list.length === 0) return;
      const idx = activeIdx(list);
      if (e.key === 'j') {
        e.preventDefault();
        focusAt(list, idx < 0 ? 0 : idx + 1);
      } else if (e.key === 'k') {
        e.preventDefault();
        focusAt(list, idx < 0 ? 0 : idx - 1);
      } else if (e.key === 'G' && e.shiftKey) {
        e.preventDefault();
        focusAt(list, list.length - 1);
      } else if (e.key === 'g' && !e.shiftKey) {
        const now = Date.now();
        if (now - lastG.current < 500) {
          e.preventDefault();
          focusAt(list, 0);
          lastG.current = 0;
        } else {
          lastG.current = now;
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [containerRef, itemSelector, enabled]);
}

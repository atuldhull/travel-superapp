/**
 * V.UX.28 — wires `@axe-core/react` in development so a11y violations
 * print to the browser console as React renders. Production builds are
 * a no-op (the dynamic import + NODE_ENV gate keep axe out of the
 * bundle).
 *
 * Sample output:
 *   "Element does not have an accessible name (button-name)"
 *   "Form elements must have labels (label)"
 *
 * Installed by prompt [V.UX.28].
 */
'use client';

import { useEffect } from 'react';

export function AxeDevBoot() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (typeof window === 'undefined') return;
    let cancelled = false;
    void (async () => {
      try {
        const ReactDOM = await import('react-dom');
        const axe = await import('@axe-core/react');
        if (cancelled) return;
        // 1000ms throttle — axe is expensive on every keystroke.
        const React = await import('react');
        await axe.default(React, ReactDOM, 1000);
      } catch {
        // Best-effort: a missing dev dep shouldn't break the page.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}

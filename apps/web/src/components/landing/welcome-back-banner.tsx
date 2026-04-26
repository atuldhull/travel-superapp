/**
 * Welcome-back banner — shown only on the second-or-later visit. If
 * we have a cached sample plan from the previous visit (< 24h), the
 * banner deep-links into the SampleTripDemo widget with that city
 * highlighted; otherwise just a friendly nudge to keep exploring.
 *
 * Mounted on the landing page (`/`). Bumps the visit count on mount
 * via `recordVisit()` so the next visit knows it's the third+.
 *
 * Installed by prompt [V.UX.2].
 */
'use client';

import { useEffect, useState } from 'react';
import {
  getRecalledSamplePlan,
  isReturningVisitor,
  recordVisit,
  type RecalledSamplePlan,
} from '../../lib/visit-recall';

export function WelcomeBackBanner() {
  const [show, setShow] = useState(false);
  const [recalled, setRecalled] = useState<RecalledSamplePlan | null>(null);

  useEffect(() => {
    // Read state BEFORE bumping so the banner reflects the prior
    // visit count (not the bumped one).
    const returning = isReturningVisitor();
    const plan = getRecalledSamplePlan();
    recordVisit();
    setShow(returning);
    setRecalled(plan);
  }, []);

  if (!show) return null;

  return (
    <aside
      role="status"
      className="rounded-md border border-brand/30 bg-brand/5 px-4 py-3 text-sm text-foreground shadow-sm"
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span aria-hidden>👋</span>
        <span className="font-medium">Welcome back!</span>
        {recalled ? (
          <>
            <span className="text-muted">
              You looked at{' '}
              <strong className="text-foreground">
                <span aria-hidden className="mr-0.5">
                  {recalled.emoji}
                </span>
                {recalled.title}
              </strong>{' '}
              last time —
            </span>
            <a href="#sample-trip" className="font-semibold text-brand hover:underline">
              pick up where you left off →
            </a>
          </>
        ) : (
          <>
            <span className="text-muted">
              Anything new since your last visit? Try a fresh sample trip below.
            </span>
            <a href="#sample-trip" className="font-semibold text-brand hover:underline">
              Jump to demo →
            </a>
          </>
        )}
      </p>
    </aside>
  );
}

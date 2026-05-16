/**
 * POST.2A.5 — the agent's surface on /trips/[id].
 *
 * Flag-gated by NEXT_PUBLIC_FEATURE_AGENT_ENABLED (mirrors the
 * server FEATURE_AGENT_ENABLED). When OFF it renders `null` — ZERO
 * new UI, no layout shift on the 58 existing pages (the critical
 * AC). When ON it shows the "agent watching" surface built ONLY
 * from existing 1.0 primitives (Card + EmptyState) — no new dep.
 *
 * The live proposal list + Accept/Decline buttons call the POST.2A.4
 * endpoints (GET /agent/runs/:id, POST /agent/proposals/:id/{accept,
 * decline}) via the generated SDK; wiring that needs those routes
 * emitted into docs/api/openapi.yaml + `pnpm --filter=@app/sdk gen`
 * (the openapi-emission pipeline) — the deferred integration glue,
 * same pattern as the 2A.3 coords / 2A.4 itinerary seams. This slice
 * ships the flag-gated surface + the SAFE-boundary messaging so the
 * behaviour is correct and inert by default.
 *
 * Installed by prompt [POST.2A.5].
 */
'use client';

import { Card, CardBody, CardHeader, CardTitle } from '../ui/card';
import { EmptyState } from '../ui/empty-state';

const AGENT_ENABLED = process.env.NEXT_PUBLIC_FEATURE_AGENT_ENABLED === 'true';

export function AgentWatchCard({ tripId }: { readonly tripId: string }) {
  // Flag off → nothing renders. This is what keeps every existing
  // page byte-identical until the agent is deliberately switched on.
  if (!AGENT_ENABLED) return null;

  return (
    <Card aria-label="Trip agent" data-trip-id={tripId}>
      <CardHeader>
        <CardTitle>🤖 Trip agent</CardTitle>
      </CardHeader>
      <CardBody>
        <EmptyState
          emoji="🛰️"
          title="Watching this trip"
          body="The agent watches for weather and schedule changes during your trip. If something material changes it will suggest a re-plan and ask you to confirm — it never changes your trip on its own."
        />
      </CardBody>
    </Card>
  );
}

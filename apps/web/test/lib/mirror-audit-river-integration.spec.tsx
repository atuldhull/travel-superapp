/** Vitest specs for AE422 `<MirrorAuditRiver/>` — jsdom integration. */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MirrorAuditRiver } from '../../src/components/aether/phase3/mirror-audit-river';
import type { MirrorAuditRow } from '../../src/components/aether/phase3/mirror-globe';

function row(id: string, kind: string, ageMs: number): MirrorAuditRow {
  return {
    id,
    kind,
    emittedAt: new Date(Date.now() - ageMs).toISOString(),
    summary: `${kind} · ${id}`,
  };
}

describe('<MirrorAuditRiver/> integration', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the header with live / total counts', () => {
    const { container } = render(
      <MirrorAuditRiver rows={[row('1', 'mutation', 1_000), row('2', 'sos', 2_000)]} />,
    );
    const header = container.querySelector('[data-aether-mirror-audit-river] header');
    expect(header?.textContent).toContain('live 2 / 2');
  });

  it('renders one row per audit-row entry', () => {
    const { container } = render(
      <MirrorAuditRiver
        rows={[row('1', 'mutation', 1_000), row('2', 'sos', 2_000), row('3', 'scam', 3_000)]}
      />,
    );
    const rows = container.querySelectorAll('[data-aether-mirror-audit-row]');
    expect(rows.length).toBe(3);
  });

  it('tags each row with the kind via data-attribute', () => {
    const { container } = render(<MirrorAuditRiver rows={[row('1', 'sos', 1_000)]} />);
    const r = container.querySelector('[data-aether-mirror-audit-row]');
    expect(r?.getAttribute('data-aether-mirror-audit-kind')).toBe('sos');
  });

  it('drops rows past the TTL after a tick', () => {
    const stale = row('stale', 'mutation', 70_000_000); // 70 million ms = 19+ hours, past 60s TTL
    const fresh = row('fresh', 'mutation', 1_000);
    const { container } = render(<MirrorAuditRiver rows={[stale, fresh]} tickMs={50} />);
    // After mount the river runs liveAuditRows; only `fresh` should appear.
    const rows = container.querySelectorAll('[data-aether-mirror-audit-row]');
    expect(rows.length).toBe(1);
    const header = container.querySelector('[data-aether-mirror-audit-river] header');
    expect(header?.textContent).toContain('live 1 / 2');
  });

  it('summary is exposed as a hover title attribute', () => {
    const { container } = render(<MirrorAuditRiver rows={[row('1', 'mutation', 1_000)]} />);
    const r = container.querySelector('[data-aether-mirror-audit-row]') as HTMLElement;
    expect(r.getAttribute('title')).toContain('mutation');
  });
});

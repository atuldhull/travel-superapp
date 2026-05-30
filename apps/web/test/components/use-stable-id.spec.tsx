/**
 * Vitest jsdom specs for AE254 useStableId.
 */
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { useStableId } from '../../src/components/aether/use-stable-id';

function Probe({ prefix, out }: { prefix?: string; out: { id: string } }): ReactElement {
  const id = useStableId(prefix);
  out.id = id;
  return <span id={id} data-testid="probe" />;
}

function TwoProbes({ out }: { out: { ids: string[] } }): ReactElement {
  const a = useStableId('a');
  const b = useStableId('b');
  out.ids = [a, b];
  return (
    <div>
      <span id={a} />
      <span id={b} />
    </div>
  );
}

describe('useStableId', () => {
  it('returns a non-empty id', () => {
    const out = { id: '' };
    render(<Probe out={out} />);
    expect(out.id.length).toBeGreaterThan(0);
  });

  it('id does NOT contain ":" (CSS-selector safe)', () => {
    const out = { id: '' };
    render(<Probe out={out} />);
    expect(out.id).not.toContain(':');
  });

  it('honours the prefix', () => {
    const out = { id: '' };
    render(<Probe prefix="atlas-row" out={out} />);
    expect(out.id.startsWith('atlas-row-')).toBe(true);
  });

  it('default prefix is "a"', () => {
    const out = { id: '' };
    render(<Probe out={out} />);
    expect(out.id.startsWith('a-')).toBe(true);
  });

  it('two ids in the same component are distinct', () => {
    const out: { ids: string[] } = { ids: [] };
    render(<TwoProbes out={out} />);
    expect(out.ids[0]).not.toBe(out.ids[1]);
  });

  it('id is queryable as CSS selector', () => {
    const out = { id: '' };
    const { container } = render(<Probe out={out} />);
    // No throw — confirms ':' is gone.
    expect(() => container.querySelector(`#${out.id}`)).not.toThrow();
  });
});

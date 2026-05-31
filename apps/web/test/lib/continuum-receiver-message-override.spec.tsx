/** AE394 — message override on the Continuum receiver toast. */
// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Phase1ContinuumReceiverToast } from '../../src/components/aether/phase1/phase1-continuum-receiver-toast';
import type { ContinuumLanding } from '../../src/components/aether/phase1/continuum-landing';

const HANDOFF: ContinuumLanding = { isHandoff: true, extras: { trip: 'abc' } };

describe('AE394 — Phase1ContinuumReceiverToast messageOverride', () => {
  it('uses messageOverride when provided', () => {
    render(
      <Phase1ContinuumReceiverToast
        landing={HANDOFF}
        messageOverride="Continued from another device · Five days in Leh"
      />,
    );
    const txt = document.querySelector('[data-aether-continuum-receiver-toast]')?.textContent;
    expect(txt).toContain('Five days in Leh');
    expect(txt).not.toContain('trip restored');
  });

  it('falls back to the AE391 formatter when override is null', () => {
    render(<Phase1ContinuumReceiverToast landing={HANDOFF} messageOverride={null} />);
    const txt = document.querySelector('[data-aether-continuum-receiver-toast]')?.textContent;
    expect(txt).toContain('trip restored');
  });

  it('falls back to the AE391 formatter when override is empty string', () => {
    render(<Phase1ContinuumReceiverToast landing={HANDOFF} messageOverride="" />);
    const txt = document.querySelector('[data-aether-continuum-receiver-toast]')?.textContent;
    expect(txt).toContain('trip restored');
  });

  it('falls back when override is undefined', () => {
    render(<Phase1ContinuumReceiverToast landing={HANDOFF} />);
    const txt = document.querySelector('[data-aether-continuum-receiver-toast]')?.textContent;
    expect(txt).toContain('Continued from another device');
  });
});

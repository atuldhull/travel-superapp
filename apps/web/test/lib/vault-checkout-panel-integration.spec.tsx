/** Vitest specs for AE432 `<VaultCheckoutPanel/>` — jsdom integration. */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { SurfaceManagerProvider, createSurfaceRegistry } from '@app/aether-core';
import type { ReactNode } from 'react';
import { VaultCheckoutPanel } from '../../src/components/aether/phase2/vault-checkout-panel';
import { VAULT_CHECKOUT_SIMULATED_DELAY_MS } from '../../src/components/aether/phase2/vault-checkout';
import type { VaultPriceLike } from '../../src/components/aether/phase2/vault-glyphs';

const PRICE: VaultPriceLike = {
  id: 'stay-leh-3-nights',
  label: '3 nights · Hotel Yangthang · Leh',
  amountMinor: 1_899_900,
  currency: 'INR',
};

function withVaultShell(children: ReactNode): React.ReactElement {
  const registry = createSurfaceRegistry([
    { id: 'vault', phase: 2, route: { kind: 'literal', pathname: '/aether/vault' } },
  ]);
  return (
    <SurfaceManagerProvider registry={registry} initialPathname="/aether/vault">
      {children}
    </SurfaceManagerProvider>
  );
}

describe('<VaultCheckoutPanel/> integration', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when price is null (panel not mounted)', () => {
    const { container } = render(
      withVaultShell(<VaultCheckoutPanel price={null} onClose={() => undefined} />),
    );
    expect(container.querySelector('[data-aether-vault-checkout]')).toBeNull();
  });

  it('mounts a role=dialog + aria-modal when price is supplied', () => {
    const { container } = render(
      withVaultShell(<VaultCheckoutPanel price={PRICE} onClose={() => undefined} />),
    );
    const dialog = container.querySelector('[data-aether-vault-checkout]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
  });

  it('renders the price title + total', () => {
    const { container } = render(
      withVaultShell(<VaultCheckoutPanel price={PRICE} onClose={() => undefined} />),
    );
    expect(container.textContent).toContain(PRICE.label);
    expect(container.querySelector('[data-aether-vault-checkout-total]')?.textContent).toContain(
      '18,999',
    );
  });

  it('starts the form in "open" status with the submit button disabled', () => {
    const { container } = render(
      withVaultShell(<VaultCheckoutPanel price={PRICE} onClose={() => undefined} />),
    );
    const dialog = container.querySelector('[data-aether-vault-checkout]');
    expect(dialog?.getAttribute('data-aether-vault-checkout-status')).toBe('open');
    const submit = container.querySelector(
      '[data-aether-vault-checkout-submit]',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('enables submit only when name and email both validate', () => {
    const { container } = render(
      withVaultShell(<VaultCheckoutPanel price={PRICE} onClose={() => undefined} />),
    );
    const name = container.querySelector('[data-aether-vault-checkout-name]') as HTMLInputElement;
    const email = container.querySelector('[data-aether-vault-checkout-email]') as HTMLInputElement;
    const submit = container.querySelector(
      '[data-aether-vault-checkout-submit]',
    ) as HTMLButtonElement;
    fireEvent.change(name, { target: { value: 'Asha Verma' } });
    expect(submit.disabled).toBe(true); // email still empty
    fireEvent.change(email, { target: { value: 'asha@example.com' } });
    expect(submit.disabled).toBe(false);
  });

  it('clicking submit drives the status through submitting → success', () => {
    const onSuccess = vi.fn();
    const { container } = render(
      withVaultShell(
        <VaultCheckoutPanel price={PRICE} onClose={() => undefined} onSuccess={onSuccess} />,
      ),
    );
    const name = container.querySelector('[data-aether-vault-checkout-name]') as HTMLInputElement;
    const email = container.querySelector('[data-aether-vault-checkout-email]') as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'Asha Verma' } });
    fireEvent.change(email, { target: { value: 'asha@example.com' } });
    const submit = container.querySelector(
      '[data-aether-vault-checkout-submit]',
    ) as HTMLButtonElement;
    fireEvent.click(submit);
    expect(
      container
        .querySelector('[data-aether-vault-checkout]')
        ?.getAttribute('data-aether-vault-checkout-status'),
    ).toBe('submitting');
    act(() => {
      vi.advanceTimersByTime(VAULT_CHECKOUT_SIMULATED_DELAY_MS + 50);
    });
    expect(
      container
        .querySelector('[data-aether-vault-checkout]')
        ?.getAttribute('data-aether-vault-checkout-status'),
    ).toBe('success');
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess.mock.calls[0][0]).toEqual(PRICE);
    expect(container.querySelector('[data-aether-vault-checkout-success]')?.textContent).toContain(
      'Booking ledger updated',
    );
  });

  it('close button invokes onClose', () => {
    const onClose = vi.fn();
    const { container } = render(
      withVaultShell(<VaultCheckoutPanel price={PRICE} onClose={onClose} />),
    );
    const closeBtn = container.querySelector(
      'button[aria-label="Close checkout"]',
    ) as HTMLButtonElement;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc key closes the panel via onClose', () => {
    const onClose = vi.fn();
    render(withVaultShell(<VaultCheckoutPanel price={PRICE} onClose={onClose} />));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('outside-click on backdrop closes the panel', () => {
    const onClose = vi.fn();
    const { container } = render(
      withVaultShell(<VaultCheckoutPanel price={PRICE} onClose={onClose} />),
    );
    const backdrop = container.querySelector('[data-aether-vault-checkout]') as HTMLDivElement;
    fireEvent.click(backdrop, { target: backdrop, currentTarget: backdrop });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('footer copy switches once status hits success', () => {
    const { container } = render(
      withVaultShell(<VaultCheckoutPanel price={PRICE} onClose={() => undefined} />),
    );
    const footer = container.querySelector('[data-aether-vault-checkout-footer]');
    expect(footer?.textContent).toContain('Stripe Checkout iframe lands later');
    const name = container.querySelector('[data-aether-vault-checkout-name]') as HTMLInputElement;
    const email = container.querySelector('[data-aether-vault-checkout-email]') as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'Asha Verma' } });
    fireEvent.change(email, { target: { value: 'asha@example.com' } });
    const submit = container.querySelector(
      '[data-aether-vault-checkout-submit]',
    ) as HTMLButtonElement;
    fireEvent.click(submit);
    act(() => {
      vi.advanceTimersByTime(VAULT_CHECKOUT_SIMULATED_DELAY_MS + 50);
    });
    const footerAfter = container.querySelector('[data-aether-vault-checkout-footer]');
    expect(footerAfter?.textContent).toContain('Confirmation handoff lands');
  });

  it('aria-live status reflects the current lifecycle', () => {
    const { container } = render(
      withVaultShell(<VaultCheckoutPanel price={PRICE} onClose={() => undefined} />),
    );
    const aria = container.querySelector('[data-aether-vault-checkout-aria-status]');
    expect(aria?.textContent).toContain('Checkout open');
    expect(aria?.textContent).toContain('Name is too short');
  });
});

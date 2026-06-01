'use client';

/**
 * AE415 — `<VaultCheckoutPanel>`.
 *
 * Right-edge slide-in panel for the Vault checkout flow. Per
 * 02-surfaces.md §8 Vault: clicking a glyph opens a "checkout in
 * Aether material" — palette-tinted, terracotta accent, sandstone
 * paper backdrop. The actual Stripe Checkout iframe + payment
 * intent round-trip ship in AE415b (`STRIPE_PUBLISHABLE_KEY` +
 * the redirect URL contract land when the real booking target
 * is plugged in).
 *
 * Today the form is real — name + email validated via AE415 pure
 * helpers — and the submission simulates the round-trip via a
 * setTimeout. The footer copy stays honest about the Stripe gap.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { useSurfacePaletteSlots } from '@app/aether-core';
import type { VaultPriceLike } from './vault-glyphs';
import {
  VAULT_CHECKOUT_SIMULATED_DELAY_MS,
  canSubmitCheckout,
  checkoutDisabledReason,
  checkoutFooterCopy,
  checkoutStatusLabel,
  checkoutSubmitLabel,
  checkoutTitle,
  checkoutTotal,
  validateCheckoutEmail,
  validateCheckoutName,
  type VaultCheckoutStatus,
} from './vault-checkout';

export interface VaultCheckoutPanelProps {
  /** The price the user tapped, or null when no panel is shown. */
  readonly price: VaultPriceLike | null;
  /** Called when the user closes the panel (× / Esc / outside click). */
  readonly onClose: () => void;
  /** Optional callback when the simulated payment succeeds. */
  readonly onSuccess?: (price: VaultPriceLike) => void;
}

export function VaultCheckoutPanel({
  price,
  onClose,
  onSuccess,
}: VaultCheckoutPanelProps): React.ReactElement | null {
  const palette = useSurfacePaletteSlots();
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [status, setStatus] = useState<VaultCheckoutStatus>(price === null ? 'idle' : 'open');

  // Reset form whenever a fresh price opens the panel.
  useEffect(() => {
    if (price !== null) {
      setName('');
      setEmail('');
      setStatus('open');
    } else {
      setStatus('idle');
    }
  }, [price]);

  // Esc closes.
  useEffect(() => {
    if (price === null) return undefined;
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return (): void => window.removeEventListener('keydown', onKey);
  }, [price, onClose]);

  if (price === null) return null;

  const submit = (): void => {
    if (!canSubmitCheckout(status, name, email)) return;
    setStatus('submitting');
    window.setTimeout(() => {
      setStatus('success');
      onSuccess?.(price);
    }, VAULT_CHECKOUT_SIMULATED_DELAY_MS);
  };

  const submitDisabled = !canSubmitCheckout(status, name, email);
  const disabledReason = checkoutDisabledReason(status, name, email);

  const backdropStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(20, 12, 8, 0.6)',
    backdropFilter: 'blur(4px)',
    zIndex: 50,
    display: 'flex',
    justifyContent: 'flex-end',
    fontFamily: 'Inter, system-ui, sans-serif',
  };

  const panelStyle: CSSProperties = {
    width: 'min(440px, 100vw)',
    height: '100vh',
    background: palette.surface,
    color: palette.ink,
    padding: 32,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    overflowY: 'auto',
    boxShadow: `-8px 0 32px rgba(0, 0, 0, 0.35)`,
  };

  const buttonStyle: CSSProperties = {
    padding: '14px 18px',
    borderRadius: 999,
    border: 'none',
    background: submitDisabled ? palette.support : palette.accent,
    color: palette.ink,
    cursor: submitDisabled ? 'not-allowed' : 'pointer',
    fontSize: 14,
    letterSpacing: '0.06em',
    fontWeight: 600,
    transition: 'opacity 200ms ease',
    opacity: submitDisabled ? 0.6 : 1,
  };

  const inputStyle: CSSProperties = {
    padding: '12px 14px',
    borderRadius: 10,
    border: `1px solid ${palette.support}`,
    background: 'rgba(255,255,255,0.6)',
    color: palette.ink,
    fontFamily: 'inherit',
    fontSize: 14,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Checkout: ${checkoutTitle(price)}`}
      data-aether-vault-checkout
      data-aether-vault-checkout-status={status}
      style={backdropStyle}
      onClick={(e) => {
        // Outside click closes (when the backdrop itself is the target).
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside style={panelStyle}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              opacity: 0.65,
            }}
          >
            Aether Checkout
          </span>
          <button
            type="button"
            aria-label="Close checkout"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              color: palette.ink,
              fontSize: 22,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </header>
        <h2
          style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontStyle: 'italic',
            fontSize: 28,
            margin: 0,
            color: palette.ink,
          }}
        >
          {checkoutTitle(price)}
        </h2>
        <p
          data-aether-vault-checkout-total
          style={{
            fontSize: 22,
            margin: 0,
            color: palette.accent,
            fontWeight: 600,
          }}
        >
          {checkoutTotal(price)}
        </p>
        <hr
          style={{
            border: 'none',
            borderTop: `1px solid ${palette.support}`,
            opacity: 0.4,
            margin: '8px 0',
          }}
        />
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, opacity: 0.75 }}>Name on booking</span>
          <input
            type="text"
            data-aether-vault-checkout-name
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Aether traveller"
            autoComplete="name"
            aria-invalid={name.length > 0 && !validateCheckoutName(name)}
            style={inputStyle}
            disabled={status === 'submitting' || status === 'success'}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, opacity: 0.75 }}>Email for confirmation</span>
          <input
            type="email"
            data-aether-vault-checkout-email
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            aria-invalid={email.length > 0 && !validateCheckoutEmail(email)}
            style={inputStyle}
            disabled={status === 'submitting' || status === 'success'}
          />
        </label>
        <button
          type="button"
          data-aether-vault-checkout-submit
          aria-disabled={submitDisabled}
          disabled={submitDisabled}
          onClick={submit}
          style={buttonStyle}
        >
          {checkoutSubmitLabel(status)}
        </button>
        {status === 'success' && (
          <p
            data-aether-vault-checkout-success
            style={{
              fontSize: 13,
              padding: '12px 14px',
              borderRadius: 10,
              background: 'rgba(110, 123, 92, 0.18)',
              border: `1px solid ${palette.support}`,
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            Booking ledger updated. The Stripe handoff lands in AE415b — for now this is a simulated
            confirmation so you can walk the surface end-to-end.
          </p>
        )}
        <span
          role="status"
          aria-live="polite"
          data-aether-vault-checkout-aria-status
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0,0,0,0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          {checkoutStatusLabel(status)}
          {disabledReason !== null ? ` — ${disabledReason}` : ''}
        </span>
        <footer
          data-aether-vault-checkout-footer
          style={{
            fontSize: 11,
            letterSpacing: '0.06em',
            opacity: 0.6,
            marginTop: 'auto',
            lineHeight: 1.5,
          }}
        >
          {checkoutFooterCopy(status)}
        </footer>
      </aside>
    </div>
  );
}

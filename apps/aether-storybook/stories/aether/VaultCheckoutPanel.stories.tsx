/**
 * VaultCheckoutPanel story (AE436) — Chromatic baseline for the AE415
 * Vault checkout slide-in. Five variants pin the lifecycle states
 * (open / submitting / success / error / disabled-empty) so the
 * Warm Italian panel chrome and submit-button copy are reviewable
 * end-to-end.
 */
import type { Meta, StoryObj } from '@storybook/react';

type Status = 'open' | 'submitting' | 'success' | 'error' | 'idle';

function submitLabel(status: Status): string {
  switch (status) {
    case 'idle':
    case 'open':
      return 'Pay with Aether';
    case 'submitting':
      return 'Processing…';
    case 'success':
      return 'Booked';
    case 'error':
      return 'Try again';
  }
}

function footerCopy(status: Status): string {
  if (status === 'success')
    return 'Confirmation handoff lands once Stripe Checkout is wired (AE415b).';
  return 'Stripe Checkout iframe lands later — this is a Phase 2 scaffold.';
}

interface PanelProps {
  readonly status: Status;
  readonly name: string;
  readonly email: string;
  readonly nameValid: boolean;
  readonly emailValid: boolean;
}

function VaultCheckoutPanel({
  status,
  name,
  email,
  nameValid,
  emailValid,
}: PanelProps): React.ReactElement {
  const disabled = status === 'submitting' || status === 'success' || !nameValid || !emailValid;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        width: 720,
        height: 720,
        background: 'rgba(20, 12, 8, 0.6)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <aside
        style={{
          width: 440,
          padding: 32,
          background: '#F2E8D5',
          color: '#1A0F09',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '-8px 0 32px rgba(0,0,0,0.35)',
        }}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between' }}>
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
          <span style={{ fontSize: 22, opacity: 0.6 }}>×</span>
        </header>
        <h2
          style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontStyle: 'italic',
            fontSize: 28,
            margin: 0,
          }}
        >
          3 nights · Hotel Yangthang · Leh
        </h2>
        <p style={{ fontSize: 22, margin: 0, color: '#C2614A', fontWeight: 600 }}>₹18,999.00</p>
        <hr style={{ border: 'none', borderTop: '1px solid #6E7B5C', opacity: 0.4 }} />
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, opacity: 0.75 }}>Name on booking</span>
          <input
            type="text"
            value={name}
            readOnly
            placeholder="Aether traveller"
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              border: `1px solid ${nameValid || name === '' ? '#6E7B5C' : '#C2614A'}`,
              background: 'rgba(255,255,255,0.6)',
              color: '#1A0F09',
              fontFamily: 'inherit',
              fontSize: 14,
            }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, opacity: 0.75 }}>Email for confirmation</span>
          <input
            type="email"
            value={email}
            readOnly
            placeholder="you@example.com"
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              border: `1px solid ${emailValid || email === '' ? '#6E7B5C' : '#C2614A'}`,
              background: 'rgba(255,255,255,0.6)',
              color: '#1A0F09',
              fontFamily: 'inherit',
              fontSize: 14,
            }}
          />
        </label>
        <button
          type="button"
          disabled={disabled}
          style={{
            padding: '14px 18px',
            borderRadius: 999,
            border: 'none',
            background: disabled ? '#6E7B5C' : '#C2614A',
            color: '#1A0F09',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: 14,
            letterSpacing: '0.06em',
            fontWeight: 600,
            opacity: disabled ? 0.6 : 1,
          }}
        >
          {submitLabel(status)}
        </button>
        {status === 'success' && (
          <p
            style={{
              fontSize: 13,
              padding: '12px 14px',
              borderRadius: 10,
              background: 'rgba(110, 123, 92, 0.18)',
              border: '1px solid #6E7B5C',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            Booking ledger updated. The Stripe handoff lands in AE415b — for now this is a simulated
            confirmation.
          </p>
        )}
        <footer
          style={{
            fontSize: 11,
            letterSpacing: '0.06em',
            opacity: 0.6,
            marginTop: 'auto',
            lineHeight: 1.5,
          }}
        >
          {footerCopy(status)}
        </footer>
      </aside>
    </div>
  );
}

const meta: Meta<typeof VaultCheckoutPanel> = {
  title: 'Aether / VaultCheckoutPanel',
  component: VaultCheckoutPanel,
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof VaultCheckoutPanel>;

export const DisabledEmpty: Story = {
  args: { status: 'open', name: '', email: '', nameValid: false, emailValid: false },
};

export const Open: Story = {
  args: {
    status: 'open',
    name: 'Asha Verma',
    email: 'asha@example.com',
    nameValid: true,
    emailValid: true,
  },
};

export const Submitting: Story = {
  args: {
    status: 'submitting',
    name: 'Asha Verma',
    email: 'asha@example.com',
    nameValid: true,
    emailValid: true,
  },
};

export const Success: Story = {
  args: {
    status: 'success',
    name: 'Asha Verma',
    email: 'asha@example.com',
    nameValid: true,
    emailValid: true,
  },
};

export const Error: Story = {
  args: {
    status: 'error',
    name: 'Asha',
    email: 'not-an-email',
    nameValid: true,
    emailValid: false,
  },
};

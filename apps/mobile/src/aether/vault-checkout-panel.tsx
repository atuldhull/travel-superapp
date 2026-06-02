/**
 * `<VaultCheckoutPanel/>` — the Vault booking panel (Phase 4 AE560).
 *
 * Per docs/aether/02-surfaces.md section 8 Vault: "tap any glyph to
 * book; checkout is an Aether-styled iframe". The native checkout panel
 * mirrors the web AE415 panel: the SAME pure FSM + validators drive it —
 * `checkoutTitle` + `checkoutTotal` + `checkoutSubmitLabel` +
 * `checkoutFooterCopy` + `validateCheckoutName` + `validateCheckoutEmail`
 * + `canSubmitCheckout` + `checkoutDisabledReason` from
 * `@app/aether-canvas-shared` (AE415, spec'd at AE495).
 *
 * AE560 ships the panel chrome + the simulated submission timeline (no
 * real Stripe charge). The real `@stripe/stripe-react-native` Checkout
 * lands with the live booking target; the panel's click → confirm path
 * is wired end-to-end here.
 *
 * Rendered as a bottom sheet inside a translucent backdrop. The Vault
 * scene (AE561) opens it on a glyph tap.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  VAULT_CHECKOUT_SIMULATED_DELAY_MS,
  canSubmitCheckout,
  checkoutDisabledReason,
  checkoutFooterCopy,
  checkoutStatusLabel,
  checkoutSubmitLabel,
  checkoutTitle,
  checkoutTotal,
  type VaultCheckoutStatus,
  type VaultPriceLike,
} from '@app/aether-canvas-shared';

export interface VaultCheckoutPanelProps {
  /** The price the tapped glyph represents. Null = panel closed. */
  price: VaultPriceLike | null;
  /** Close the panel (backdrop tap or after a booking). */
  onClose: () => void;
}

export function VaultCheckoutPanel({
  price,
  onClose,
}: VaultCheckoutPanelProps): React.ReactElement | null {
  const [status, setStatus] = useState<VaultCheckoutStatus>('open');
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset the form each time a new price opens the panel.
  useEffect(() => {
    if (price) {
      setStatus('open');
      setName('');
      setEmail('');
    }
  }, [price]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const onSubmit = useCallback(() => {
    setStatus('submitting');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setStatus('success');
    }, VAULT_CHECKOUT_SIMULATED_DELAY_MS);
  }, []);

  if (price === null) return null;

  const canSubmit = canSubmitCheckout(status, name, email);
  const disabledReason = checkoutDisabledReason(status, name, email);
  const submitLabel = checkoutSubmitLabel(status);

  return (
    <View style={styles.backdrop}>
      <Pressable
        style={styles.backdropFill}
        onPress={onClose}
        accessibilityLabel="Close checkout"
      />
      <View style={styles.sheet}>
        <Text style={styles.title}>{checkoutTitle(price)}</Text>
        <Text style={styles.total}>{checkoutTotal(price)}</Text>

        <Text style={styles.statusLine} accessibilityLiveRegion="polite" accessibilityRole="text">
          {checkoutStatusLabel(status)}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Full name"
          placeholderTextColor="#9B8E7E"
          value={name}
          onChangeText={setName}
          editable={status === 'open' || status === 'error'}
          autoCapitalize="words"
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9B8E7E"
          value={email}
          onChangeText={setEmail}
          editable={status === 'open' || status === 'error'}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Pressable
          style={[styles.payButton, !canSubmit && styles.payButtonDisabled]}
          disabled={!canSubmit}
          onPress={onSubmit}
          accessibilityRole="button"
          accessibilityLabel={submitLabel}
        >
          <Text style={styles.payButtonText}>{submitLabel}</Text>
        </Pressable>

        {disabledReason ? <Text style={styles.disabledReason}>{disabledReason}</Text> : null}

        {status === 'success' ? (
          <Pressable style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        ) : null}

        <Text style={styles.footer}>{checkoutFooterCopy(status)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  backdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 8, 6, 0.6)',
  },
  sheet: {
    backgroundColor: '#24201C',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F2E8D5',
  },
  total: {
    fontSize: 28,
    fontWeight: '700',
    color: '#E8B777',
  },
  statusLine: {
    fontSize: 12,
    color: '#9B8E7E',
  },
  input: {
    backgroundColor: '#1A1714',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#F2E8D5',
  },
  payButton: {
    backgroundColor: '#C2614A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  payButtonDisabled: {
    backgroundColor: '#5A4A40',
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F2E8D5',
  },
  disabledReason: {
    fontSize: 12,
    color: '#C2854A',
    textAlign: 'center',
  },
  doneButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  doneButtonText: {
    fontSize: 15,
    color: '#E8B777',
    fontWeight: '600',
  },
  footer: {
    fontSize: 11,
    color: '#6E6155',
    textAlign: 'center',
    lineHeight: 16,
  },
});

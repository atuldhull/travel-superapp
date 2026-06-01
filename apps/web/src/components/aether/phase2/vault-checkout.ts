/**
 * Vault checkout state — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE479 so the Phase 4
 * native Vault checkout form reuses the same validators + lifecycle
 * labels + button copy. This file remains so existing imports keep
 * working.
 */
export {
  CHECKOUT_NAME_MIN_LENGTH,
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
} from '@app/aether-canvas-shared';

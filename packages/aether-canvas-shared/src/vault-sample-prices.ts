/**
 * AE414 — shared Vault sample-price catalogue.
 *
 * Lifted out of `phase2-vault-shell.tsx` so the R3F scene + the 2D
 * label overlay agree on the SAME fixture set + the SAME min/max
 * weighting. Real prices come from `useStaysControllerSearch` +
 * `useTransportControllerRoutes` in a later slice.
 */
import type { VaultPriceLike } from './vault-glyphs';

export const SAMPLE_VAULT_PRICES: ReadonlyArray<VaultPriceLike> = Object.freeze([
  {
    id: 'leh-stay-7d',
    label: 'Leh — sky garden stay (7 nights)',
    amountMinor: 4_200_000,
    currency: 'INR',
    history: [4_500_000, 4_480_000, 4_450_000, 4_420_000, 4_380_000, 4_250_000, 4_200_000],
  },
  {
    id: 'goa-stay-3d',
    label: 'Goa — palm villa (3 nights)',
    amountMinor: 1_800_000,
    currency: 'INR',
    history: [1_900_000, 1_880_000, 1_870_000, 1_840_000, 1_820_000, 1_810_000, 1_800_000],
  },
  {
    id: 'jaipur-flight',
    label: 'Mumbai → Jaipur — return',
    amountMinor: 980_000,
    currency: 'INR',
    history: [1_050_000, 1_020_000, 1_010_000, 1_000_000, 990_000, 985_000, 980_000],
  },
  {
    id: 'kerala-houseboat',
    label: 'Alleppey — houseboat (2 nights)',
    amountMinor: 2_600_000,
    currency: 'INR',
    history: [2_700_000, 2_680_000, 2_660_000, 2_640_000, 2_620_000, 2_610_000, 2_600_000],
  },
]);

/** Min amount across the sample set (cached so the scene doesn't
 *  recompute every render). */
export const SAMPLE_VAULT_MIN_AMOUNT: number = Math.min(
  ...SAMPLE_VAULT_PRICES.map((p) => p.amountMinor),
);

/** Max amount across the sample set. */
export const SAMPLE_VAULT_MAX_AMOUNT: number = Math.max(
  ...SAMPLE_VAULT_PRICES.map((p) => p.amountMinor),
);

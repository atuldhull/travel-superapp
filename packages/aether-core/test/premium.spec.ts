/** Premium-rule tests — guard the locked gating policy (06-decisions.md #5). */
import { defaultPremiumRule, type PremiumCapability, type PremiumTier } from '../src/premium';

const ALL_CAPS: PremiumCapability[] = [
  'genie-camera',
  'genie-voice',
  'predictor-auto',
  'compass-eye',
  'lumen-pdf',
];

describe('defaultPremiumRule', () => {
  it('pro unlocks every capability', () => {
    for (const cap of ALL_CAPS) {
      expect(defaultPremiumRule('pro', cap)).toBe(true);
    }
  });

  it('plus unlocks lumen-pdf + genie-voice only', () => {
    expect(defaultPremiumRule('plus', 'lumen-pdf')).toBe(true);
    expect(defaultPremiumRule('plus', 'genie-voice')).toBe(true);
    expect(defaultPremiumRule('plus', 'genie-camera')).toBe(false);
    expect(defaultPremiumRule('plus', 'predictor-auto')).toBe(false);
    expect(defaultPremiumRule('plus', 'compass-eye')).toBe(false);
  });

  it('free unlocks nothing', () => {
    for (const cap of ALL_CAPS) {
      expect(defaultPremiumRule('free', cap)).toBe(false);
    }
  });

  it('anonymous (null tier) unlocks nothing', () => {
    for (const cap of ALL_CAPS) {
      expect(defaultPremiumRule(null as PremiumTier, cap)).toBe(false);
    }
  });
});

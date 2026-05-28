/** Pure-function tests for the resolved-policy helper. */
import { __testing } from '../src/reduced-motion';

describe('resolvePolicy', () => {
  const { resolvePolicy } = __testing;

  it("user 'none' override wins over system 'full'", () => {
    expect(resolvePolicy(false, 'none')).toBe('none');
  });

  it("user 'full' override wins over system reduced", () => {
    expect(resolvePolicy(true, 'full')).toBe('full');
  });

  it("user 'essential' is honored", () => {
    expect(resolvePolicy(false, 'essential')).toBe('essential');
  });

  it('no override + system reduced = essential', () => {
    expect(resolvePolicy(true, null)).toBe('essential');
  });

  it('no override + no system pref = full (the Aether default)', () => {
    expect(resolvePolicy(false, null)).toBe('full');
  });
});

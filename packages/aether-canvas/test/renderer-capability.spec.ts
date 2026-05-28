/** Renderer capability tests — runs in node (no DOM/canvas). */
import { detectRenderer, defaultRenderer } from '../src/renderer-capability';

describe('defaultRenderer', () => {
  it('returns webgl2 as the safe default for SSR / initial render', () => {
    const cap = defaultRenderer();
    expect(cap.mode).toBe('webgl2');
    expect(cap.webgl2Available).toBe(true);
    expect(cap.webgpuAvailable).toBe(false);
    expect(cap.adapterLabel).toBeNull();
  });
});

describe('detectRenderer (node env, no window/navigator)', () => {
  it("returns 'none' when navigator is undefined", async () => {
    // jest-node already has no navigator/document; just call it.
    const cap = await detectRenderer();
    expect(cap.mode).toBe('none');
    expect(cap.webgpuAvailable).toBe(false);
    expect(cap.webgl2Available).toBe(false);
  });
});

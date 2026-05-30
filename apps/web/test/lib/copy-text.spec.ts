/**
 * Vitest specs for the AE196 shared `copyTextToClipboard` helper.
 *
 * The helper tries `navigator.clipboard.writeText` first (when secure
 * context); falls back to `execCommand('copy')` on a hidden textarea.
 * These specs mock both paths so the contract is asserted without
 * actually writing to the host clipboard.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyTextToClipboard } from '../../src/lib/copy-text';

// Patch document.execCommand (missing in jsdom) so the helper's
// fallback path is exercisable. The patched version is replaced
// per-test via vi.spyOn().
let execStub: ReturnType<typeof vi.fn> | null = null;
function installExecCommand(): ReturnType<typeof vi.fn> {
  execStub = vi.fn(() => false);
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    writable: true,
    value: (cmd: string) => (execStub?.(cmd) ?? false) as boolean,
  });
  return execStub;
}

describe('copyTextToClipboard', () => {
  let originalClipboard: typeof navigator.clipboard | undefined;
  beforeEach(() => {
    originalClipboard = navigator.clipboard;
    installExecCommand();
  });
  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
    vi.restoreAllMocks();
  });

  it('returns false on empty string (short-circuit)', async () => {
    const got = await copyTextToClipboard('');
    expect(got).toBe(false);
  });

  it('uses the Clipboard API when isSecureContext is true', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    const ok = await copyTextToClipboard('hello');
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back to the textarea path when Clipboard API throws', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('denied');
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    execStub?.mockReturnValue(true);
    const ok = await copyTextToClipboard('fallback-text');
    expect(ok).toBe(true);
    expect(execStub).toHaveBeenCalledWith('copy');
  });

  it('falls back to the textarea path when isSecureContext is false', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
    execStub?.mockReturnValue(true);
    const ok = await copyTextToClipboard('http-origin');
    expect(ok).toBe(true);
    expect(execStub).toHaveBeenCalledWith('copy');
  });

  it('returns false when execCommand returns false (both paths failed)', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
    execStub?.mockReturnValue(false);
    const ok = await copyTextToClipboard('no-luck');
    expect(ok).toBe(false);
  });

  it('cleans up the transient textarea even on success', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
    execStub?.mockReturnValue(true);
    const before = document.body.children.length;
    await copyTextToClipboard('x');
    expect(document.body.children.length).toBe(before);
  });
});

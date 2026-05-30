/**
 * AE196 — shared "copy text to clipboard" helper, used by both the
 * AE113 checklist `copy as bullets` and the AE189 Pulse copy-bubble.
 *
 * Tries the modern Clipboard API first (only available in secure
 * contexts on most browsers); falls back to a hidden-textarea +
 * document.execCommand when the API is unavailable. Resolves to true
 * on success, false on every failure path.
 */

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (text === '') return false;
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  // Modern path: Clipboard API in a secure context.
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard !== undefined &&
    window.isSecureContext === true
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the textarea path.
    }
  }
  // Fallback: a transient hidden textarea + execCommand('copy'). Old
  // but works across browsers + http:// origins.
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.left = '-9999px';
    ta.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

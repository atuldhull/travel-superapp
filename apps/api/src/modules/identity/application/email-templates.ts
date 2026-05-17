/**
 * Branded transactional email templates — premium "royal" identity
 * (deep ink + champagne-gold), built for real-world email clients:
 *
 *   - Table-based layout + 100% inline styles (Gmail/Outlook strip
 *     <head><style>, classes, and fl/grid).
 *   - A bullet-proof VML-free gold CTA button (padding-on-anchor
 *     pattern) that renders in Gmail, Apple Mail, Outlook.
 *   - A copy-paste URL fallback (some clients disable buttons).
 *   - A tasteful shimmer on the header rule via a <style> keyframe —
 *     best-effort (Apple Mail honours it; Gmail ignores it and shows
 *     the static gold gradient). The STATIC design is the guarantee;
 *     animation is progressive enhancement, never required.
 *   - Plaintext alternative always returned (deliverability + a11y).
 *
 * Pure functions, no I/O — unit-testable.
 *
 * Installed for the premium-email pass.
 */

export interface EmailParts {
  readonly subject: string;
  readonly textBody: string;
  readonly htmlBody: string;
}

const INK = '#0c0d12';
const INK_2 = '#15172210';
const GOLD = '#cdab63';
const GOLD_DK = '#b3873b';

function shell(opts: {
  readonly preheader: string;
  readonly appName: string;
  readonly heading: string;
  readonly intro: string;
  readonly ctaLabel: string;
  readonly ctaUrl: string;
  readonly rawUrl: string;
  readonly footnote: string;
}): string {
  const { preheader, appName, heading, intro, ctaLabel, ctaUrl, rawUrl, footnote } = opts;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(appName)}</title>
<style>
  @media (prefers-reduced-motion: no-preference) {
    .tsa-rule { background-size: 200% 100%; animation: tsa-shimmer 3.2s linear infinite; }
    @keyframes tsa-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  }
  a.tsa-btn:hover { filter: brightness(1.05); }
</style>
</head>
<body style="margin:0;padding:0;background:#070810;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070810;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0c0d12;border:1px solid rgba(205,171,99,0.22);border-radius:20px;overflow:hidden;">
      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#1d2850 0%,#2a3a73 50%,#3a2d57 100%);padding:36px 40px 30px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;">
            <span style="display:inline-block;width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,${GOLD_DK},${GOLD});text-align:center;line-height:34px;font:700 16px Georgia,serif;color:#1d2850;">T</span>
          </td>
          <td style="vertical-align:middle;padding-left:12px;font:600 19px Georgia,'Times New Roman',serif;letter-spacing:.3px;color:#ffffff;">
            Travel<span style="color:${GOLD};">Super</span>App
          </td>
        </tr></table>
      </td></tr>
      <!-- Gold rule (animated where supported) -->
      <tr><td class="tsa-rule" style="height:3px;background:linear-gradient(90deg,${GOLD_DK},${GOLD},#e9d6a3,${GOLD},${GOLD_DK});"></td></tr>
      <!-- Body -->
      <tr><td style="padding:40px 40px 8px;">
        <h1 style="margin:0 0 14px;font:600 26px Georgia,'Times New Roman',serif;color:#ffffff;letter-spacing:-.2px;">${escapeHtml(heading)}</h1>
        <p style="margin:0 0 28px;font:400 15px/1.65 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:rgba(255,255,255,0.66);">${escapeHtml(intro)}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 26px;"><tr>
          <td style="border-radius:12px;background:linear-gradient(135deg,${GOLD_DK},${GOLD});">
            <a class="tsa-btn" href="${escapeAttr(ctaUrl)}" target="_blank" rel="noopener noreferrer"
               style="display:inline-block;padding:14px 30px;font:600 15px -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#15172a;text-decoration:none;border-radius:12px;">
              ${escapeHtml(ctaLabel)} &nbsp;&rarr;
            </a>
          </td>
        </tr></table>
        <p style="margin:0 0 6px;font:400 12px -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:rgba(255,255,255,0.4);">Button not working? Paste this link into your browser:</p>
        <p style="margin:0 0 30px;font:400 12px ui-monospace,SFMono-Regular,Menlo,monospace;color:${GOLD};word-break:break-all;">${escapeHtml(rawUrl)}</p>
        <div style="height:1px;background:rgba(205,171,99,0.16);margin:0 0 22px;"></div>
        <p style="margin:0;font:400 12px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:rgba(255,255,255,0.38);">${escapeHtml(footnote)}</p>
      </td></tr>
      <!-- Footer -->
      <tr><td style="padding:26px 40px 34px;">
        <p style="margin:0;font:400 11px -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:rgba(255,255,255,0.28);">
          ${escapeHtml(appName)} — your AI travel companion. You received this because someone entered this address to sign in. If that wasn't you, no action is needed.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

/** Passwordless sign-in / account-verification link email. */
export function magicLinkEmail(opts: {
  readonly appName: string;
  readonly magicUrl: string;
  readonly ttlMinutes: number;
}): EmailParts {
  const { appName, magicUrl, ttlMinutes } = opts;
  const subject = `Your sign-in link for ${appName}`;
  const intro =
    `Tap the button below to securely sign in to ${appName}. ` +
    `This link is single-use and expires in ${ttlMinutes} minutes.`;
  const footnote =
    `For your security this link only works once and from this device's browser. ` +
    `It will stop working after ${ttlMinutes} minutes — just request a new one if it lapses.`;
  const textBody =
    `${appName} — secure sign-in\n\n` +
    `Hi,\n\n` +
    `Use the link below to sign in to ${appName}. It is single-use and ` +
    `expires in ${ttlMinutes} minutes.\n\n` +
    `${magicUrl}\n\n` +
    `If you didn't request this, you can safely ignore this email.\n`;
  const htmlBody = shell({
    preheader: `Your single-use ${appName} sign-in link — expires in ${ttlMinutes} minutes.`,
    appName,
    heading: 'Sign in to your account',
    intro,
    ctaLabel: 'Sign in securely',
    ctaUrl: magicUrl,
    rawUrl: magicUrl,
    footnote,
  });
  return { subject, textBody, htmlBody };
}

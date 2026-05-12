/**
 * POST.7 — Print a fresh VAPID keypair for Web Push.
 *
 * VAPID keys are self-generated — no service signup, no account,
 * no fee. The browser vendors (Mozilla / Google / Apple) accept
 * any well-formed P-256 keypair; the public key identifies your
 * server to them and the private key signs the JWT every push
 * fan-out carries. Generated once per environment, then pasted
 * into `apps/api/.env`.
 *
 * Usage:
 *   pnpm --filter=api vapid:generate
 *   # → prints VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… block
 *
 * Run again to rotate (invalidates every active browser
 * subscription — they'll auto-resubscribe on next visit, but the
 * old endpoints flag 410 Gone and are reaped by
 * `web-push-dispatcher.ts`).
 */
import * as webPush from 'web-push';

function main(): void {
  const { publicKey, privateKey } = webPush.generateVAPIDKeys();
  // eslint-disable-next-line no-console
  console.log(
    [
      '',
      '# ─── POST.7 — VAPID keypair (drop into apps/api/.env) ──────────────',
      `VAPID_PUBLIC_KEY=${publicKey}`,
      `VAPID_PRIVATE_KEY=${privateKey}`,
      `VAPID_SUBJECT=mailto:no-reply@travel.local`,
      '',
      '# Also expose the public key to the browser so the service worker',
      '# can subscribe (Next.js inlines NEXT_PUBLIC_* into the client bundle):',
      `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`,
      '',
    ].join('\n'),
  );
}

main();

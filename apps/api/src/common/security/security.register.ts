/**
 * Wires every response-side security primitive onto the Fastify app:
 *
 *   1. @fastify/helmet — CSP (with per-request nonces), COOP, COEP, CORP,
 *                        Referrer-Policy, X-Content-Type-Options, X-Frame-
 *                        Options, HSTS (prod only), X-DNS-Prefetch-Control.
 *   2. @fastify/cors   — exact-origin allow-list from `CORS_ORIGINS`.
 *   3. onSend hook     — Permissions-Policy (not in helmet yet).
 *
 * Called once from `main.ts` BEFORE `app.listen()`, so every route —
 * including `/health/*` — gets the same perimeter.
 *
 * Installed by prompt [IV.18.1.17]. See Playbook §13 "Security".
 */
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Env } from '@app/config';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';

const PERMISSIONS_POLICY_HEADER = [
  'accelerometer=()',
  'autoplay=()',
  'camera=()',
  'clipboard-read=()',
  'clipboard-write=()',
  'display-capture=()',
  'encrypted-media=()',
  'fullscreen=()',
  'geolocation=()',
  'gyroscope=()',
  'hid=()',
  'idle-detection=()',
  'interest-cohort=()',
  'magnetometer=()',
  'microphone=()',
  'midi=()',
  'payment=()',
  'picture-in-picture=()',
  'publickey-credentials-get=()',
  'screen-wake-lock=()',
  'serial=()',
  'sync-xhr=()',
  'usb=()',
  'xr-spatial-tracking=()',
].join(', ');

export function parseCorsOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function registerSecurity(app: NestFastifyApplication, env: Env): Promise<void> {
  const isProd = env.NODE_ENV === 'production';
  const origins = parseCorsOrigins(env.CORS_ORIGINS);

  await app.register(fastifyHelmet, {
    // Per-request nonces: helmet generates `reply.cspNonce.script` /
    // `reply.cspNonce.style` and injects `'nonce-<value>'` into the right
    // directives for this single response.
    enableCSPNonces: true,
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: [`'none'`],
        scriptSrc: [`'self'`],
        scriptSrcAttr: [`'none'`],
        styleSrc: [`'self'`],
        imgSrc: [`'self'`, 'data:', 'https:'],
        fontSrc: [`'self'`],
        connectSrc: [`'self'`],
        frameAncestors: [`'none'`],
        baseUri: [`'self'`],
        formAction: [`'self'`],
        objectSrc: [`'none'`],
        // Trusted Types: enforce in prod so any injection-sink library is
        // forced to opt into a vetted policy. In dev it's report-only via
        // a distinct directive — here we go full-strict in prod only to
        // avoid breaking localhost dev tooling that injects inline eval.
        ...(isProd
          ? {
              requireTrustedTypesFor: [`'script'`],
              trustedTypes: [`'none'`],
              upgradeInsecureRequests: [],
            }
          : {}),
      },
    },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginEmbedderPolicy: { policy: 'require-corp' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    xDnsPrefetchControl: { allow: false },
    xFrameOptions: { action: 'deny' },
    // HSTS over localhost is a footgun (pins dev browsers to https). Off
    // in dev/test; on in staging/production.
    strictTransportSecurity: isProd
      ? { maxAge: 63_072_000, includeSubDomains: true, preload: true }
      : false,
  });

  await app.register(fastifyCors, {
    // Deny-by-default when CORS_ORIGINS is empty — origin stays absent in
    // the response, so the browser blocks the cross-origin response.
    origin: origins.length > 0 ? origins : false,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
    maxAge: 600,
  });

  // Permissions-Policy — helmet 13 has no built-in for it.
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onSend', async (_request, reply, payload) => {
      reply.header('Permissions-Policy', PERMISSIONS_POLICY_HEADER);
      return payload;
    });
}

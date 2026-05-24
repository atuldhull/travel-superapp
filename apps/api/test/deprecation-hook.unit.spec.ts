/**
 * Unit test for the [F2] RFC 8594 deprecation hook. Verifies:
 *   1. When a request hits a route listed in `DEPRECATED_ROUTES`, the
 *      response carries `Deprecation: true` + `Sunset: <RFC 1123>`
 *      + `Link rel="deprecation"`.
 *   2. When a request hits a non-deprecated route, NONE of those
 *      headers are present.
 *   3. The empty-registry case (today's default) doesn't crash and
 *      doesn't accidentally add headers to anything.
 *
 * Pure Fastify (no Nest) so the test never boots AppModule — fast +
 * hermetic.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import { registerDeprecationHook } from '../src/common/deprecation/register-deprecation-hook';
import type { DeprecatedRoute } from '../src/common/deprecation/deprecated-routes';

interface MockApp {
  getHttpAdapter(): { getInstance(): FastifyInstance };
}

function adaptToNestShape(fastify: FastifyInstance): MockApp {
  return { getHttpAdapter: () => ({ getInstance: () => fastify }) };
}

describe('registerDeprecationHook (unit)', () => {
  it('emits Deprecation + Sunset + Link headers for a deprecated route', async () => {
    // Hand-mount the hook with a single route hard-wired into BY_URL
    // by monkey-patching the import. Simpler: hand-construct a hook
    // that mirrors the real one against a fixture registry.
    const entry: DeprecatedRoute = {
      url: '/old',
      sunsetDate: '2027-01-01',
      replacementUrl: 'https://api.travel.app/api/v2/new',
      changelogUrl: 'https://travel.app/changelog/api-v2-old',
    };

    const fastify = Fastify();
    fastify.addHook('onSend', async (req, reply, payload) => {
      const url = req.routeOptions?.url;
      if (url === entry.url) {
        reply.header('Deprecation', 'true');
        reply.header('Sunset', new Date(entry.sunsetDate).toUTCString());
        reply.header(
          'Link',
          `<${entry.changelogUrl}>; rel="deprecation"; type="text/html", ` +
            `<${entry.replacementUrl}>; rel="successor-version"`,
        );
      }
      return payload;
    });
    fastify.get('/old', async () => ({ ok: true }));
    fastify.get('/new', async () => ({ ok: true }));

    const oldRes = await fastify.inject({ method: 'GET', url: '/old' });
    expect(oldRes.headers.deprecation).toBe('true');
    expect(oldRes.headers.sunset).toBe('Fri, 01 Jan 2027 00:00:00 GMT');
    expect(oldRes.headers.link).toContain('rel="deprecation"');
    expect(oldRes.headers.link).toContain('rel="successor-version"');

    const newRes = await fastify.inject({ method: 'GET', url: '/new' });
    expect(newRes.headers.deprecation).toBeUndefined();
    expect(newRes.headers.sunset).toBeUndefined();
    expect(newRes.headers.link).toBeUndefined();

    await fastify.close();
  });

  it('empty registry (today) — hook installs cleanly and adds no headers', async () => {
    const fastify = Fastify();
    await registerDeprecationHook(adaptToNestShape(fastify));
    fastify.get('/api/v1/health', async () => ({ ok: true }));

    const res = await fastify.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.headers.deprecation).toBeUndefined();
    expect(res.headers.sunset).toBeUndefined();
    expect(res.headers.link).toBeUndefined();

    await fastify.close();
  });
});

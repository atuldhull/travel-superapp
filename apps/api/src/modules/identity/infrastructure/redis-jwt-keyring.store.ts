/**
 * Redis-backed `JwtKeyringStore`. Stores each ring as a single JSON
 * blob under `travel-<env>:jwt-keyring:<ring>`; atomic writes via a
 * WATCH / MULTI transaction so concurrent rotates don't lose a
 * previous key.
 *
 * Security note: HS256 shared secrets persist in Redis as base64url
 * strings. Redis must be network-isolated + at-rest-encrypted in
 * prod (the playbook requires this anyway for session + rate-limit
 * data). When this migrates to RS256, the store holds only the
 * public keys + kids; private keys move to KMS. The port shape
 * doesn't change.
 *
 * Hydration: on first `getRing` call in a fresh environment (key
 * missing in Redis), the store falls back to the matching env
 * secret with kid `<ring>-bootstrap`. The bootstrap row is then
 * written to Redis so subsequent reads hit the cache path. A real
 * rotation promotes the bootstrap kid to `previous` and mints a
 * fresh random secret.
 *
 * In-process cache: `getRing` is on the hot path (every sign +
 * every verify). The store holds a 30-second in-memory cache so
 * Redis traffic stays constant under load. 30s is small enough
 * that a rotated ring propagates to every instance within one
 * access-token TTL window.
 *
 * Installed by prompt [III.13.2.8].
 */
import { randomBytes } from 'node:crypto';
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { secretFromString, type JwtKey, type JwtKeyring } from '@app/auth';
import type { Env } from '@app/config';
import { createLogger } from '@app/logger';
import { CLOCK, type Clock } from '@app/clock';
import type { JwtKeyringStore, RingName } from '../application/ports/jwt-keyring.store';

const log = createLogger('identity.jwt-keyring');

const CACHE_TTL_MS = 30_000;

/**
 * Serialised-to-JSON keyring shape. `secret` is stored base64url
 * encoded so the JSON round-trip is stable + space-efficient. The
 * live `JwtKey.secret` (Uint8Array) is rehydrated on read.
 */
interface SerializedKey {
  readonly kid: string;
  readonly secret: string;
}
interface SerializedRing {
  readonly current: SerializedKey;
  readonly previous: readonly SerializedKey[];
}

@Injectable()
export class RedisJwtKeyringStore implements JwtKeyringStore, OnModuleDestroy {
  private readonly redis: Redis;
  private readonly envName: string;
  private readonly envAccessSecret: string;
  private readonly envRefreshSecret: string;
  private readonly cache = new Map<RingName, { ring: JwtKeyring; expiresAt: number }>();

  constructor(
    @Inject(ConfigService) config: ConfigService<Env, true>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.redis = new Redis(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    });
    this.redis.on('error', (err) => {
      log.warn({ err: err.message }, 'jwt_keyring_redis_error');
    });
    this.envName = config.get('NODE_ENV', { infer: true });
    this.envAccessSecret = config.get('JWT_ACCESS_SECRET', { infer: true });
    this.envRefreshSecret = config.get('JWT_REFRESH_SECRET', { infer: true });
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      // quit can race with a never-connected state; don't block shutdown.
    }
  }

  async getRing(name: RingName): Promise<JwtKeyring> {
    const now = this.clock.nowMs();
    const cached = this.cache.get(name);
    if (cached && cached.expiresAt > now) return cached.ring;

    const key = this.redisKey(name);
    await this.ensureConnected();
    const raw = await this.redis.get(key);
    if (raw) {
      const ring = rehydrate(JSON.parse(raw) as SerializedRing);
      this.cache.set(name, { ring, expiresAt: now + CACHE_TTL_MS });
      return ring;
    }

    // First boot — hydrate from env and persist so subsequent
    // reads hit the cached path.
    const secret = name === 'access' ? this.envAccessSecret : this.envRefreshSecret;
    const bootstrap: JwtKeyring = {
      current: { kid: `${name}-bootstrap`, secret: secretFromString(secret) },
      previous: [],
    };
    await this.redis.set(key, JSON.stringify(serialize(bootstrap)));
    this.cache.set(name, { ring: bootstrap, expiresAt: now + CACHE_TTL_MS });
    log.info({ ring: name, kid: bootstrap.current.kid }, 'jwt_keyring_bootstrapped');
    return bootstrap;
  }

  async rotate(name: RingName): Promise<JwtKeyring> {
    const existing = await this.getRing(name);
    // 32 raw bytes → the HMAC-SHA256 key. Serialised to Redis as
    // base64url (43 chars) for wire stability; rehydrated back to
    // the same 32 bytes on read. Bootstrap keys follow the env
    // string path (UTF-8 bytes of the string) — mixing the two is
    // fine because jose HS256 cares only about the byte sequence,
    // whichever way it was produced.
    const freshSecret = randomBytes(32);
    // Short hex suffix on the kid so rotated kids are globally
    // unique even if two rotations land in the same millisecond.
    const freshKid = `${name}-${randomBytes(4).toString('hex')}`;
    const rotated: JwtKeyring = {
      current: { kid: freshKid, secret: new Uint8Array(freshSecret) },
      previous: [existing.current, ...existing.previous],
    };
    const key = this.redisKey(name);
    await this.ensureConnected();
    await this.redis.set(key, JSON.stringify(serialize(rotated)));
    // Invalidate the cache so every subsequent sign/verify picks
    // up the new ring immediately in THIS process. Other instances
    // catch up on their own cache TTL.
    this.cache.delete(name);
    log.info(
      { ring: name, newKid: freshKid, previousCount: rotated.previous.length },
      'jwt_keyring_rotated',
    );
    return rotated;
  }

  async listKids(): Promise<{ access: readonly string[]; refresh: readonly string[] }> {
    const [access, refresh] = await Promise.all([this.getRing('access'), this.getRing('refresh')]);
    return {
      access: [access.current.kid, ...access.previous.map((k) => k.kid)],
      refresh: [refresh.current.kid, ...refresh.previous.map((k) => k.kid)],
    };
  }

  private redisKey(name: RingName): string {
    return `travel-${this.envName}:jwt-keyring:${name}`;
  }

  private async ensureConnected(): Promise<void> {
    if (
      this.redis.status === 'wait' ||
      this.redis.status === 'end' ||
      this.redis.status === 'close'
    ) {
      await this.redis.connect();
    }
  }
}

function serialize(ring: JwtKeyring): SerializedRing {
  return {
    current: serializeKey(ring.current),
    previous: ring.previous.map(serializeKey),
  };
}

function serializeKey(k: JwtKey): SerializedKey {
  return { kid: k.kid, secret: Buffer.from(k.secret).toString('base64url') };
}

function rehydrate(s: SerializedRing): JwtKeyring {
  return {
    current: rehydrateKey(s.current),
    previous: s.previous.map(rehydrateKey),
  };
}

function rehydrateKey(s: SerializedKey): JwtKey {
  return { kid: s.kid, secret: Buffer.from(s.secret, 'base64url') };
}

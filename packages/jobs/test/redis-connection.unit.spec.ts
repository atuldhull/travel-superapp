import { buildRedisConnection, DEFAULT_JOB_OPTS } from '../src/index';

describe('@app/jobs · buildRedisConnection', () => {
  it('parses host + port from a plain redis:// URL', () => {
    const opts = buildRedisConnection('redis://127.0.0.1:6379');
    expect(opts.host).toBe('127.0.0.1');
    expect(opts.port).toBe(6379);
    expect(opts.password).toBeUndefined();
    expect(opts.tls).toBeUndefined();
  });

  it('extracts password from auth-bearing URLs (Upstash form)', () => {
    const opts = buildRedisConnection('redis://default:secret_pw@host.upstash.io:6379');
    expect(opts.host).toBe('host.upstash.io');
    expect(opts.username).toBe('default');
    expect(opts.password).toBe('secret_pw');
  });

  it('extracts password-only auth (legacy form)', () => {
    const opts = buildRedisConnection('redis://:redis_dev@127.0.0.1:6379');
    expect(opts.password).toBe('redis_dev');
    // ioredis interprets `username=""` as "no username" — we forward
    // undefined to keep parity.
    expect(opts.username).toBeUndefined();
  });

  it('enables TLS when the URL uses rediss://', () => {
    const opts = buildRedisConnection('rediss://default:pw@host.upstash.io:6379');
    expect(opts.tls).toEqual({});
  });

  it('defaults port to 6379 when omitted', () => {
    const opts = buildRedisConnection('redis://127.0.0.1');
    expect(opts.port).toBe(6379);
  });

  it('parses db index from the URL path', () => {
    const opts = buildRedisConnection('redis://127.0.0.1:6379/3');
    expect(opts.db).toBe(3);
  });

  it('defaults db to 0 when path is empty or "/"', () => {
    expect(buildRedisConnection('redis://127.0.0.1:6379').db).toBe(0);
    expect(buildRedisConnection('redis://127.0.0.1:6379/').db).toBe(0);
  });

  it('forces BullMQ-required maxRetriesPerRequest=null', () => {
    // BullMQ throws on startup if this isn't null — blocking commands
    // (BRPOPLPUSH etc.) need to be allowed to retry indefinitely.
    const opts = buildRedisConnection('redis://127.0.0.1:6379');
    expect(opts.maxRetriesPerRequest).toBeNull();
  });
});

describe('@app/jobs · DEFAULT_JOB_OPTS', () => {
  it('uses exponential backoff with 5 attempts', () => {
    expect(DEFAULT_JOB_OPTS.attempts).toBe(5);
    expect(DEFAULT_JOB_OPTS.backoff.type).toBe('exponential');
    expect(DEFAULT_JOB_OPTS.backoff.delay).toBe(1_000);
  });

  it('removes completed jobs after 24h or 1000-deep history', () => {
    expect(DEFAULT_JOB_OPTS.removeOnComplete).toEqual({ age: 24 * 3600, count: 1_000 });
  });

  it('keeps failed jobs for 7 days before age-out', () => {
    expect(DEFAULT_JOB_OPTS.removeOnFail).toEqual({ age: 7 * 24 * 3600 });
  });
});

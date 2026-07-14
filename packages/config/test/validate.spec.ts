import { EnvValidationError, validateEnv } from '../src/validate';

/**
 * A minimal-valid-env that exercises every required field. Individual
 * tests tweak this base to isolate failure modes.
 */
const BASE_VALID_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://travel:travel_dev@localhost:5432/travel_dev',
  REDIS_URL: 'redis://:redis_dev@localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'travel-dev',
  S3_ACCESS_KEY: 'minio',
  S3_SECRET_KEY: 'minio_dev_password',
  MEILI_MASTER_KEY: 'meili_dev_key_change_me_minimum_16_chars',
  RATE_LIMIT_PEPPER: 'c'.repeat(32),
  EMAIL_PEPPER: 'd'.repeat(32),
  BACKUP_CODE_PEPPER: 'e'.repeat(32),
};

describe('validateEnv', () => {
  it('parses a minimal valid env', () => {
    const env = validateEnv(BASE_VALID_ENV);
    expect(env.NODE_ENV).toBe('test');
    expect(env.DATABASE_URL).toBe(BASE_VALID_ENV.DATABASE_URL);
    expect(env.REDIS_URL).toBe(BASE_VALID_ENV.REDIS_URL);
  });

  it('applies defaults for optional scalars', () => {
    const env = validateEnv(BASE_VALID_ENV);
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.JWT_ACCESS_EXPIRY).toBe('15m');
    expect(env.JWT_REFRESH_EXPIRY).toBe('30d');
    expect(env.DATABASE_POOL_MIN).toBe(2);
    expect(env.DATABASE_POOL_MAX).toBe(10);
    expect(env.AI_SERVICE_URL).toBe('http://localhost:8001');
    expect(env.MEILI_HOST).toBe('http://localhost:7700');
    expect(env.S3_REGION).toBe('us-east-1');
    expect(env.FEATURE_3D_ENABLED).toBe(false);
    expect(env.FEATURE_SATELLITE_CROWD).toBe(false);
  });

  it('coerces numeric strings to numbers', () => {
    const env = validateEnv({ ...BASE_VALID_ENV, PORT: '4000', DATABASE_POOL_MAX: '25' });
    expect(env.PORT).toBe(4000);
    expect(typeof env.PORT).toBe('number');
    expect(env.DATABASE_POOL_MAX).toBe(25);
  });

  it('throws EnvValidationError on a missing required key', () => {
    const { DATABASE_URL: _omit, ...without } = BASE_VALID_ENV;
    expect(() => validateEnv(without)).toThrow(EnvValidationError);
  });

  it('EnvValidationError exposes structured issues', () => {
    const { DATABASE_URL: _omit, JWT_ACCESS_SECRET: _secret, ...without } = BASE_VALID_ENV;
    try {
      validateEnv(without);
      throw new Error('expected validateEnv to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      const e = err as EnvValidationError;
      expect(e.issues.length).toBeGreaterThanOrEqual(2);
      const paths = e.issues.map((i) => i.path);
      expect(paths).toEqual(expect.arrayContaining(['DATABASE_URL', 'JWT_ACCESS_SECRET']));
      expect(e.message).toContain('Invalid environment configuration');
      expect(e.message).toContain('DATABASE_URL');
    }
  });

  it('rejects an invalid URL', () => {
    expect(() => validateEnv({ ...BASE_VALID_ENV, DATABASE_URL: 'not-a-url' })).toThrow(
      EnvValidationError,
    );
  });

  it('rejects a too-short JWT secret', () => {
    expect(() => validateEnv({ ...BASE_VALID_ENV, JWT_ACCESS_SECRET: 'too-short' })).toThrow(
      EnvValidationError,
    );
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() =>
      validateEnv({ ...BASE_VALID_ENV, NODE_ENV: 'staging-eu' as NodeJS.ProcessEnv['NODE_ENV'] }),
    ).toThrow(EnvValidationError);
  });

  it('accepts optional OAuth, Stripe, and comms providers when present', () => {
    const env = validateEnv({
      ...BASE_VALID_ENV,
      GOOGLE_CLIENT_ID: 'gcid',
      GOOGLE_CLIENT_SECRET: 'gsec',
      STRIPE_SECRET_KEY: 'sk_test_xxx',
      RESEND_API_KEY: 're_xxx',
      TWILIO_ACCOUNT_SID: 'ACxxx',
    });
    expect(env.GOOGLE_CLIENT_ID).toBe('gcid');
    expect(env.STRIPE_SECRET_KEY).toBe('sk_test_xxx');
    expect(env.RESEND_API_KEY).toBe('re_xxx');
  });

  it('coerces feature-flag booleans from string env values', () => {
    const env = validateEnv({
      ...BASE_VALID_ENV,
      FEATURE_3D_ENABLED: 'true',
      FEATURE_SATELLITE_CROWD: 'true',
    });
    expect(env.FEATURE_3D_ENABLED).toBe(true);
    expect(env.FEATURE_SATELLITE_CROWD).toBe(true);
  });

  it('defaults to process.env when no argument is supplied', () => {
    const prev = { ...process.env };
    Object.assign(process.env, BASE_VALID_ENV);
    try {
      const env = validateEnv();
      expect(env.DATABASE_URL).toBe(BASE_VALID_ENV.DATABASE_URL);
    } finally {
      // Restore.
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, prev);
    }
  });
});

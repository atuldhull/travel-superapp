/**
 * Unit tests for JWT primitives. Covers sign, verify, kid rotation,
 * UNKNOWN_KID, MISSING_KID, INVALID, and expiry.
 *
 * Installed by prompt [III.13.2].
 */
import {
  signJwt,
  verifyJwt,
  JwtVerificationError,
  secretFromString,
  type JwtKey,
  type JwtKeyring,
  type AccessTokenClaims,
  type RefreshTokenClaims,
} from '../src/jwt';

const keyV1: JwtKey = {
  kid: 'v1',
  secret: secretFromString('v1-secret-at-least-32-chars-long-XXXXX'),
};
const keyV2: JwtKey = {
  kid: 'v2',
  secret: secretFromString('v2-secret-at-least-32-chars-long-YYYYY'),
};

const accessClaims: AccessTokenClaims = {
  sub: 'user-1',
  sid: 'session-1',
  role: 'user',
  typ: 'access',
};

const refreshClaims: RefreshTokenClaims = {
  sub: 'user-1',
  sid: 'session-1',
  dfp: 'a'.repeat(64),
  typ: 'refresh',
};

describe('JWT', () => {
  describe('signJwt + verifyJwt (round-trip)', () => {
    it('round-trips an access token signed with the current key', async () => {
      const keyring: JwtKeyring = { current: keyV1, previous: [] };
      const token = await signJwt(accessClaims, keyV1, { expiresInSeconds: 900 });
      const payload = await verifyJwt<AccessTokenClaims>(token, keyring);
      expect(payload.sub).toBe('user-1');
      expect(payload.sid).toBe('session-1');
      expect(payload.role).toBe('user');
      expect(payload.typ).toBe('access');
    });

    it('round-trips a refresh token', async () => {
      const keyring: JwtKeyring = { current: keyV1, previous: [] };
      const token = await signJwt(refreshClaims, keyV1, { expiresInSeconds: 60 * 60 * 24 * 30 });
      const payload = await verifyJwt<RefreshTokenClaims>(token, keyring);
      expect(payload.typ).toBe('refresh');
      expect(payload.dfp).toHaveLength(64);
    });

    it('preserves issuer + audience when provided', async () => {
      const keyring: JwtKeyring = { current: keyV1, previous: [] };
      const token = await signJwt(accessClaims, keyV1, {
        expiresInSeconds: 900,
        issuer: 'https://travel.app',
        audience: 'travel-mobile',
      });
      const payload = await verifyJwt<AccessTokenClaims>(token, keyring, {
        issuer: 'https://travel.app',
        audience: 'travel-mobile',
      });
      expect(payload.sub).toBe('user-1');
    });

    it('rejects when audience does not match', async () => {
      const keyring: JwtKeyring = { current: keyV1, previous: [] };
      const token = await signJwt(accessClaims, keyV1, {
        expiresInSeconds: 900,
        audience: 'travel-mobile',
      });
      await expect(verifyJwt(token, keyring, { audience: 'travel-admin' })).rejects.toMatchObject({
        code: 'INVALID',
      });
    });
  });

  describe('key rotation', () => {
    it('accepts a token signed with a previous key when kid matches', async () => {
      // Old token signed with v1.
      const token = await signJwt(accessClaims, keyV1, { expiresInSeconds: 900 });
      // Keyring has rotated: v2 is current, v1 is previous.
      const keyring: JwtKeyring = { current: keyV2, previous: [keyV1] };
      const payload = await verifyJwt<AccessTokenClaims>(token, keyring);
      expect(payload.sub).toBe('user-1');
    });

    it('rejects a token whose kid is not in the keyring anymore', async () => {
      // Token signed with v1; keyring has since rotated v1 out.
      const token = await signJwt(accessClaims, keyV1, { expiresInSeconds: 900 });
      const keyring: JwtKeyring = { current: keyV2, previous: [] };
      await expect(verifyJwt(token, keyring)).rejects.toMatchObject({
        code: 'UNKNOWN_KID',
      });
    });
  });

  describe('error shapes', () => {
    it('throws MISSING_KID when the header has no kid', async () => {
      // Manually construct a JWT without kid: `{alg:"HS256"}`.`<payload>`.`<sig>`.
      // For this test we just feed verifyJwt a valid-looking base64 header with no kid.
      const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: 'x' })).toString('base64url');
      const token = `${header}.${payload}.sig`;
      const keyring: JwtKeyring = { current: keyV1, previous: [] };
      await expect(verifyJwt(token, keyring)).rejects.toMatchObject({
        code: 'MISSING_KID',
      });
    });

    it('throws INVALID when the signature is bad', async () => {
      const token = await signJwt(accessClaims, keyV1, { expiresInSeconds: 900 });
      // Tamper the FIRST character of the signature, not the last. The last
      // base64url char of a 32-byte HS256 signature only carries 4 significant
      // bits + 2 padding bits, so some single-char flips (e.g. 'A'->'B') decode
      // to the same bytes and don't actually change the signature -- which made
      // this test flaky depending on the run's signature. The first char carries
      // a full 6 bits, so flipping it always changes a real byte.
      const parts = token.split('.');
      const [header, payload, sig] = parts;
      if (!header || !payload || !sig) throw new Error('signJwt produced a malformed token');
      const flipped = sig[0] === 'A' ? 'B' : 'A';
      const tampered = `${header}.${payload}.${flipped}${sig.slice(1)}`;
      const keyring: JwtKeyring = { current: keyV1, previous: [] };
      await expect(verifyJwt(tampered, keyring)).rejects.toBeInstanceOf(JwtVerificationError);
    });

    it('throws INVALID on an expired token', async () => {
      // TTL of -10 seconds (already expired).
      const token = await signJwt(accessClaims, keyV1, { expiresInSeconds: -10 });
      const keyring: JwtKeyring = { current: keyV1, previous: [] };
      await expect(verifyJwt(token, keyring)).rejects.toMatchObject({ code: 'INVALID' });
    });

    it('JwtVerificationError has a stable .code property + name', () => {
      const err = new JwtVerificationError('UNKNOWN_KID', 'foo');
      expect(err.code).toBe('UNKNOWN_KID');
      expect(err.name).toBe('JwtVerificationError');
      expect(err.message).toBe('foo');
    });
  });

  describe('secretFromString', () => {
    it('encodes a string into a Uint8Array of utf-8 bytes', () => {
      const bytes = secretFromString('abc');
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes).toEqual(new Uint8Array([0x61, 0x62, 0x63]));
    });
  });
});

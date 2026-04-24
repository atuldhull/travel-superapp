/**
 * Rotate one JWT ring (`access` or `refresh`). Owner-gate is at the
 * controller layer (`@Roles('admin')`) — this use-case is
 * auth-agnostic; it just delegates to the store.
 *
 * Returns the post-rotation kid set so the admin client can log
 * the change + the retiring-kid list for rotation-window bookkeeping.
 * Listening for outstanding tokens signed with the previous kids is
 * an ops concern (tail the request logs for `UNKNOWN_KID` after
 * dropping a previous key); nothing to do here.
 *
 * Installed by prompt [III.13.2.8].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '@app/errors';
import { JWT_KEYRING_STORE, type JwtKeyringStore, type RingName } from './ports/jwt-keyring.store';

export interface RotateJwksCommand {
  readonly ring: string;
}

export interface RotateJwksResult {
  readonly ring: RingName;
  readonly newKid: string;
  readonly previousKids: readonly string[];
}

const VALID_RINGS: readonly RingName[] = ['access', 'refresh'];

@Injectable()
export class RotateJwksUseCase {
  constructor(@Inject(JWT_KEYRING_STORE) private readonly keyrings: JwtKeyringStore) {}

  async execute(cmd: RotateJwksCommand): Promise<RotateJwksResult> {
    if (!isValidRing(cmd.ring)) {
      throw new ValidationError(
        `Unknown ring: ${cmd.ring}`,
        { ring: [`must be one of ${VALID_RINGS.join(', ')}`] },
        { ring: cmd.ring },
        'INVALID_RING',
      );
    }
    const updated = await this.keyrings.rotate(cmd.ring);
    return {
      ring: cmd.ring,
      newKid: updated.current.kid,
      previousKids: updated.previous.map((k) => k.kid),
    };
  }
}

function isValidRing(value: string): value is RingName {
  return (VALID_RINGS as readonly string[]).includes(value);
}

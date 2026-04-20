/**
 * Register a new user + issue their first session.
 *
 * Scope kept narrow for this slice:
 *   • argon2id password hash (delegated to `@app/auth`).
 *   • Email normalized to lowercase and hashed (sha256 with `EMAIL_PEPPER`)
 *     for the `emailHash` uniqueness lookup. The encrypted blob is
 *     stored too so we can return the email later. [III.13.11] will
 *     land full field-level encryption; for now we stash utf-8 bytes
 *     (no decryption API is exposed yet, so nothing reads plaintext).
 *   • Duplicate-email check → ConflictError.
 *
 * Installed by prompt [III.13.2] part 2.
 */
import { Inject, Injectable } from '@nestjs/common';
import { hashPassword } from '@app/auth';
import { ConflictError } from '@app/errors';
import {
  IssueSessionUseCase,
  type IssueSessionCommand,
  type IssuedSession,
} from './issue-session.use-case';
import { USER_REPOSITORY, type UserRepository } from './ports/user.repository';
import { hashEmail } from '../infrastructure/email-hash';

export interface RegisterCommand {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly deviceContext: Omit<IssueSessionCommand, 'userId' | 'role'>;
}

@Injectable()
export class RegisterUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly issueSession: IssueSessionUseCase,
  ) {}

  async execute(cmd: RegisterCommand): Promise<IssuedSession & { userId: string }> {
    const emailNormalized = cmd.email.trim().toLowerCase();
    const emailHash = hashEmail(emailNormalized);

    const existing = await this.users.findByEmailHash(emailHash);
    if (existing) {
      throw new ConflictError('Email already registered', {}, 'EMAIL_TAKEN');
    }

    const passwordHash = await hashPassword(cmd.password);
    const user = await this.users.create({
      emailHash,
      emailEncrypted: Buffer.from(emailNormalized, 'utf8'),
      passwordHash,
      displayName: cmd.displayName,
    });

    const issued = await this.issueSession.execute({
      ...cmd.deviceContext,
      userId: user.id,
      role: user.role,
    });
    return { ...issued, userId: user.id };
  }
}

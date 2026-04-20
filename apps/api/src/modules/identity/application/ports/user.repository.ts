/**
 * Port for user persistence, used by register + login. Kept minimal
 * for this slice — only what IssueSessionUseCase + RefreshSessionUseCase
 * actually need. Profile edits, preferences, MFA, OAuth links land in
 * their own prompts.
 *
 * Installed by prompt [III.13.2] part 2.
 */
export type UserRole = 'user' | 'premium' | 'agent' | 'admin';

export interface UserRecord {
  readonly id: string;
  readonly emailHash: string;
  readonly passwordHash: string | null;
  readonly role: UserRole;
  readonly displayName: string;
}

export interface CreateUserInput {
  readonly emailHash: string;
  readonly emailEncrypted: Buffer;
  readonly passwordHash: string;
  readonly displayName: string;
}

export interface UserRepository {
  create(input: CreateUserInput): Promise<UserRecord>;
  findByEmailHash(emailHash: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
}

export const USER_REPOSITORY = Symbol('UserRepository');

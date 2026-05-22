/**
 * Admin promotion CLI. Flips a user's `role` to `'admin'` given their
 * plaintext email. Closes the bootstrap loop opened by `[IV.18.3.1]`
 * — the HTTP surface exists, but there's no way to mint the first
 * admin without this (production won't have direct DB access).
 *
 * Usage:
 *   pnpm --filter=api exec tsx scripts/promote-admin.ts <email>
 *
 * Requirements:
 *   - `EMAIL_PEPPER` env var set (same pepper the API uses at runtime —
 *     otherwise `emailHash` won't match the stored row).
 *   - `DATABASE_URL` pointing at the target DB.
 *
 * Behaviour:
 *   - user not found           → exit 1, prints `{ ok:false, reason:"USER_NOT_FOUND" }`
 *   - user already role=admin → exit 0, prints `{ ok:true, kind:"ALREADY_ADMIN" }` (idempotent)
 *   - otherwise                → flips the row, exit 0, prints previous + new role
 *
 * Core is exported as `promoteUserToAdmin(prisma, emailLower)` so the
 * integration test can call it directly against the test DB without
 * spawning a subprocess.
 *
 * Installed by prompt [IV.18.3.2].
 */
import 'reflect-metadata';
import { PrismaClient, type User } from '@prisma/client';
import { hashEmail } from '../src/common/crypto/email-hash';

type PrismaLike = Pick<PrismaClient, 'user'>;

export type PromotionResult =
  | { kind: 'PROMOTED'; userId: string; email: string; previousRole: User['role'] }
  | { kind: 'ALREADY_ADMIN'; userId: string; email: string }
  | { kind: 'USER_NOT_FOUND'; email: string };

/**
 * Look the user up by `emailHash` and set `role = 'admin'`. Idempotent:
 * a second call on an already-admin row returns `ALREADY_ADMIN` without
 * a DB write. Throws if `EMAIL_PEPPER` is missing (reused from the
 * shared `hashEmail` helper).
 */
export async function promoteUserToAdmin(
  prisma: PrismaLike,
  rawEmail: string,
): Promise<PromotionResult> {
  const email = rawEmail.trim().toLowerCase();
  const hash = hashEmail(email);
  const user = await prisma.user.findUnique({
    where: { emailHash: hash },
    select: { id: true, role: true },
  });
  if (!user) {
    return { kind: 'USER_NOT_FOUND', email };
  }
  if (user.role === 'admin') {
    return { kind: 'ALREADY_ADMIN', userId: user.id, email };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { role: 'admin' },
  });
  return { kind: 'PROMOTED', userId: user.id, email, previousRole: user.role };
}

interface ParsedArgs {
  readonly email: string | null;
  readonly error: string | null;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  // argv here is `process.argv.slice(2)` — already has node + script stripped.
  const positional = argv.filter((a) => !a.startsWith('-'));
  if (positional.length !== 1) {
    return {
      email: null,
      error: `Expected exactly 1 email arg, got ${positional.length}. Usage: promote-admin <email>`,
    };
  }
  const email = positional[0]!;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { email: null, error: `'${email}' does not look like an email address` };
  }
  return { email, error: null };
}

export async function runCli(
  argv: readonly string[],
  depsOverride?: { prisma?: PrismaLike },
): Promise<{
  exitCode: 0 | 1;
  result: PromotionResult | { kind: 'USAGE_ERROR'; message: string };
}> {
  const parsed = parseArgs(argv);
  if (parsed.error || !parsed.email) {
    return { exitCode: 1, result: { kind: 'USAGE_ERROR', message: parsed.error ?? 'bad args' } };
  }

  // Construct a PrismaClient only when the caller didn't inject one —
  // tests share their existing PrismaService instance.
  let ownedClient: PrismaClient | null = null;
  const prisma: PrismaLike = depsOverride?.prisma ?? (ownedClient = new PrismaClient());

  try {
    const result = await promoteUserToAdmin(prisma, parsed.email);
    const exitCode = result.kind === 'USER_NOT_FOUND' ? 1 : 0;
    return { exitCode, result };
  } finally {
    if (ownedClient) {
      await ownedClient.$disconnect();
    }
  }
}

async function main(): Promise<void> {
  const { exitCode, result } = await runCli(process.argv.slice(2));
  // JSON-line output so operators / CI can pipe into jq. Writing to
  // stdout regardless of success — stderr is reserved for truly
  // unexpected errors (uncaught exceptions below).
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: exitCode === 0, ...result }));
  process.exit(exitCode);
}

// Only auto-run when invoked directly (tsx / node). The `require.main ===
// module` check keeps jest's import for tests from triggering main().
if (require.main === module) {
  main().catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        ok: false,
        kind: 'UNHANDLED_ERROR',
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    process.exit(1);
  });
}

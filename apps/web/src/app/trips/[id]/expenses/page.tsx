/**
 * V.UX.5 frequent-business-traveler. `/trips/:id/expenses` —
 * promotes the api-side expense surface to web. Owner OR active-share
 * caller can list / record / delete expenses; per-user net balances
 * render alongside.
 *
 * Solo posture: V.UX.5 personas track their own reimbursable
 * expenses. The "split" is single-user (1.0 share to self), so the
 * Balances pane just shows total spend = balance owed to caller.
 * Group-split UI (slider, multi-user picker) lands when the V.UX.6
 * family persona ships.
 *
 * Export-CSV is a client-side blob download — same pattern as the
 * Export-PDF button on `/trips/:id`, no server round-trip.
 *
 * Installed by prompt [V.UX.5].
 */
'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Download, Receipt, Scale, Trash2, Wallet } from 'lucide-react';
import {
  getExpensesControllerBalancesQueryKey,
  getExpensesControllerListQueryKey,
  useAuthControllerMe,
  useExpensesControllerBalances,
  useExpensesControllerCreate,
  useExpensesControllerList,
  useExpensesControllerRemove,
  useExpensesControllerSettleUp,
  useTripControllerGetOne,
  type CreateExpenseRequestDto,
  type ListBalancesResponseDto,
  type ListExpensesResponseDto,
  type SettleUpResponseDto,
  type TripDto,
  type UserBalanceDto,
  type WhoAmIResponseDto,
} from '@app/sdk';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../../components/ui/card';
import { Field } from '../../../../components/ui/input';
import { Skeleton } from '../../../../components/ui/skeleton';
import { useAuthBootComplete, useAuthToken } from '../../../../lib/use-auth-token';

interface ExpenseRow {
  readonly id: string;
  readonly tripId: string;
  readonly paidById: string;
  readonly amountUsd: string;
  readonly currency: string;
  readonly note: string | null;
  readonly createdAt: string;
}

export default function TripExpensesPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const tripId = params?.id ?? '';
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  const { data: tripData } = useTripControllerGetOne(tripId, {
    query: { enabled: token !== null && tripId !== '' },
  });
  const { data: meData } = useAuthControllerMe({ query: { enabled: token !== null } });
  const me = meData?.data as unknown as WhoAmIResponseDto | undefined;
  const trip = tripData?.data as unknown as TripDto | undefined;

  const {
    data: listData,
    isLoading: listLoading,
    isError: listError,
  } = useExpensesControllerList(
    tripId,
    { limit: '500' },
    { query: { enabled: token !== null && tripId !== '' } },
  );
  const { data: balancesData, isLoading: balancesLoading } = useExpensesControllerBalances(tripId, {
    query: { enabled: token !== null && tripId !== '' },
  });
  const { data: settleData } = useExpensesControllerSettleUp(tripId, {
    query: { enabled: token !== null && tripId !== '' },
  });

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [note, setNote] = useState('');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const createMutation = useExpensesControllerCreate({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getExpensesControllerListQueryKey(tripId),
        });
        await queryClient.invalidateQueries({
          queryKey: getExpensesControllerBalancesQueryKey(tripId),
        });
        setAmount('');
        setNote('');
        setErrMsg(null);
      },
      onError: (err: unknown) => {
        const e = err as { code?: string; message?: string; status?: number };
        setErrMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Create failed.'}`);
      },
    },
  });

  const deleteMutation = useExpensesControllerRemove({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getExpensesControllerListQueryKey(tripId),
        });
        await queryClient.invalidateQueries({
          queryKey: getExpensesControllerBalancesQueryKey(tripId),
        });
      },
      onError: (err: unknown) => {
        const e = err as { code?: string; message?: string; status?: number };
        setErrMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Delete failed.'}`);
      },
    },
  });

  if (!bootComplete) {
    return (
      <main>
        <p className="text-muted">Restoring your session…</p>
      </main>
    );
  }
  if (token === null) {
    return (
      <main>
        <p className="text-muted">Redirecting to sign in…</p>
      </main>
    );
  }

  const expenses: readonly ExpenseRow[] =
    ((listData?.data as unknown as ListExpensesResponseDto | undefined)?.expenses as
      | readonly ExpenseRow[]
      | undefined) ?? [];
  const balances: readonly UserBalanceDto[] =
    (balancesData?.data as unknown as ListBalancesResponseDto | undefined)?.balances ?? [];
  const totalUsd = expenses.reduce((sum, e) => sum + Number(e.amountUsd || 0), 0);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrMsg(null);
    if (!me) {
      setErrMsg('Not signed in.');
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErrMsg('Amount must be a positive number.');
      return;
    }
    // Solo split — full share to self. Group split UI lands in V.UX.6.
    const data: CreateExpenseRequestDto = {
      amountUsd: amt.toFixed(2),
      currency: currency.trim().toUpperCase() || 'USD',
      ...(note.trim() ? { note: note.trim() as unknown as CreateExpenseRequestDto['note'] } : {}),
      splitShare: { [me.sub]: 1 } as unknown as CreateExpenseRequestDto['splitShare'],
    };
    createMutation.mutate({ tripId, data });
  }

  function exportCsv() {
    const rows: string[] = ['date,amount_usd,currency,note,id'];
    for (const e of expenses) {
      const date = new Date(e.createdAt).toISOString();
      const noteCsv = (e.note ?? '').replace(/"/g, '""');
      rows.push(`${date},${e.amountUsd},${e.currency},"${noteCsv}",${e.id}`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${tripId.slice(0, 8)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <main className="space-y-8">
      <p>
        <Link
          href={`/trips/${tripId}` as never}
          className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 transition hover:text-gold-600 hover:underline"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Back to trip
        </Link>
      </p>

      {/* Cinematic royal header band — matches /trips + /stays. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <Wallet aria-hidden className="h-3.5 w-3.5" /> Trip budget
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Expenses
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          {trip
            ? trip.title
            : 'Track every reimbursable dollar — record spend, see net balances, and settle up.'}
        </p>
      </header>

      <Card depth="raised">
        <CardHeader>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <CardTitle>Running total</CardTitle>
            <span className="font-mono text-2xl font-semibold text-gold-600 dark:text-gold-300">
              ${totalUsd.toFixed(2)}
            </span>
          </div>
          <CardSubtitle>Sum of every expense recorded on this trip in USD.</CardSubtitle>
        </CardHeader>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={expenses.length === 0}>
          <Download aria-hidden className="h-3.5 w-3.5" /> Export CSV for reimbursement
        </Button>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add expense</CardTitle>
          <CardSubtitle>Solo split — every dollar goes on your reimbursement tab.</CardSubtitle>
        </CardHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Amount (USD)"
              type="number"
              step="0.01"
              min={0.01}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <Field
              label="Currency"
              type="text"
              maxLength={3}
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              help="ISO-4217 (USD, EUR…)"
              required
            />
            <Field
              label="Note (optional)"
              type="text"
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {errMsg ? (
            <p className="rounded-2xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {errMsg}
            </p>
          ) : null}
          <Button
            type="submit"
            variant="royal"
            size="sm"
            loading={createMutation.isPending}
            disabled={createMutation.isPending}
          >
            <Receipt aria-hidden className="h-3.5 w-3.5" />
            {createMutation.isPending ? 'Saving…' : 'Add expense'}
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardSubtitle>Most recent first.</CardSubtitle>
        </CardHeader>
        {listLoading ? (
          <Skeleton className="h-4 w-2/3" count={3} />
        ) : listError ? (
          <p className="text-sm text-danger">Couldn't load expenses.</p>
        ) : expenses.length === 0 ? (
          <p className="text-sm text-muted">No expenses yet.</p>
        ) : (
          <ul className="space-y-3">
            {expenses.map((e) => (
              <li
                key={e.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25 hover:shadow-(--shadow-depth-2)"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-surface-foreground">
                    ${Number(e.amountUsd).toFixed(2)} {e.currency}
                  </p>
                  {e.note ? <p className="truncate text-xs text-muted">{e.note}</p> : null}
                  <p className="text-[10px] text-muted/70">
                    {new Date(e.createdAt).toLocaleString()}
                  </p>
                </div>
                {me && e.paidById === me.sub ? (
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate({ tripId, id: e.id })}
                    disabled={deleteMutation.isPending}
                    aria-label="Delete expense"
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-danger/25 px-3 py-1 text-xs text-danger transition hover:bg-danger/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger/40 disabled:opacity-50"
                  >
                    <Trash2 aria-hidden className="h-3.5 w-3.5" /> Delete
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Scale aria-hidden className="h-4 w-4 text-gold-600 dark:text-gold-400" /> Net balances
          </CardTitle>
          <CardSubtitle>
            Per-user &ldquo;who owes whom&rdquo; ledger. Positive = is owed; negative = owes.
          </CardSubtitle>
        </CardHeader>
        {balancesLoading ? (
          <Skeleton className="h-4 w-1/2" count={2} />
        ) : balances.length === 0 ? (
          <p className="text-sm text-muted">No balances yet — record an expense above.</p>
        ) : (
          <ul className="space-y-2">
            {balances.map((b) => {
              const net = Number(b.netUsd);
              const variant = net >= 0 ? 'gold' : 'neutral';
              const isMe = me && b.userId === me.sub;
              return (
                <li
                  key={b.userId}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-gold-600/12 bg-surface px-4 py-2.5 text-sm shadow-(--shadow-depth-1) transition hover:border-gold-600/25"
                >
                  <span className="inline-flex min-w-0 items-center gap-2 truncate font-mono text-xs">
                    {b.userId.slice(0, 12)}… {isMe ? <Badge variant="gold">you</Badge> : null}
                  </span>
                  <span className="font-mono">
                    <Badge variant={variant}>${net.toFixed(2)}</Badge>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Settle up</CardTitle>
          <CardSubtitle>
            Greedy minimum-cashflow plan — N-1 transfers max for N non-zero balances.
          </CardSubtitle>
        </CardHeader>
        {(() => {
          const transfers =
            (settleData?.data as unknown as SettleUpResponseDto | undefined)?.transfers ?? [];
          if (transfers.length === 0) {
            return (
              <p className="text-sm text-muted">
                Nothing to settle — every balance is zero (or no expenses yet).
              </p>
            );
          }
          return (
            <ul className="space-y-2">
              {transfers.map((t, i) => (
                <li
                  key={`${t.fromUserId}-${t.toUserId}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-gold-600/12 bg-surface px-4 py-2.5 text-sm shadow-(--shadow-depth-1) transition hover:border-gold-600/25"
                >
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                    <code className="rounded-md border border-gold-600/20 bg-gold-500/8 px-1.5 py-0.5 text-surface-foreground">
                      {t.fromUserId.slice(0, 8)}…
                    </code>
                    <ArrowRight
                      aria-hidden
                      className="h-3.5 w-3.5 text-gold-600 dark:text-gold-400"
                    />
                    <code className="rounded-md border border-gold-600/20 bg-gold-500/8 px-1.5 py-0.5 text-surface-foreground">
                      {t.toUserId.slice(0, 8)}…
                    </code>
                  </span>
                  <span className="font-mono font-semibold text-gold-600 dark:text-gold-300">
                    ${Number(t.amountUsd).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          );
        })()}
      </Card>
    </main>
  );
}

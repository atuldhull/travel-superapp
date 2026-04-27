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
import {
  getExpensesControllerBalancesQueryKey,
  getExpensesControllerListQueryKey,
  useAuthControllerMe,
  useExpensesControllerBalances,
  useExpensesControllerCreate,
  useExpensesControllerList,
  useExpensesControllerRemove,
  useTripControllerGetOne,
  type CreateExpenseRequestDto,
  type ListBalancesResponseDto,
  type ListExpensesResponseDto,
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
    <main className="space-y-6">
      <p>
        <Link href={`/trips/${tripId}` as never} className="text-sm text-muted hover:underline">
          ← Back to trip
        </Link>
      </p>
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
        {trip ? <p className="text-sm text-muted">{trip.title}</p> : null}
      </header>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <CardTitle>Running total</CardTitle>
            <span className="font-mono text-2xl text-brand">${totalUsd.toFixed(2)}</span>
          </div>
          <CardSubtitle>Sum of every expense recorded on this trip in USD.</CardSubtitle>
        </CardHeader>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={expenses.length === 0}>
          📊 Export CSV for reimbursement
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
            <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {errMsg}
            </p>
          ) : null}
          <Button type="submit" size="sm" disabled={createMutation.isPending}>
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
          <ul className="divide-y divide-muted/15">
            {expenses.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="font-mono text-sm">
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
                    className="text-xs text-danger hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Net balances</CardTitle>
          <CardSubtitle>
            Per-user "who owes whom" ledger. Positive = is owed; negative = owes.
          </CardSubtitle>
        </CardHeader>
        {balancesLoading ? (
          <Skeleton className="h-4 w-1/2" count={2} />
        ) : balances.length === 0 ? (
          <p className="text-sm text-muted">No balances yet — record an expense above.</p>
        ) : (
          <ul className="space-y-1">
            {balances.map((b) => {
              const net = Number(b.netUsd);
              const variant = net >= 0 ? 'brand' : 'neutral';
              const isMe = me && b.userId === me.sub;
              return (
                <li key={b.userId} className="flex items-center justify-between text-sm">
                  <span className="truncate font-mono text-xs">
                    {b.userId.slice(0, 12)}… {isMe ? <Badge variant="neutral">you</Badge> : null}
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
    </main>
  );
}

/**
 * V.UX.20 — eatery detail page for the foodie persona. Public-read
 * dish list (anyone can browse) + auth-gated "report a dish" form
 * (name, priceUsd, photoUrl, caption). Anonymous visitors see a
 * sign-in nudge instead of the form.
 *
 * Installed by prompt [V.UX.20].
 */
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getFoodControllerDishesQueryKey,
  useFoodControllerCreateDish,
  useFoodControllerDishes,
  type AddDishReportRequestDto,
  type DishDto,
  type ListDishesResponseDto,
} from '@app/sdk';
import { DishCard } from '../../../components/food/dish-card';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { Field } from '../../../components/ui/input';
import { Skeleton } from '../../../components/ui/skeleton';
import { useAuthToken } from '../../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function EateryDetailPage() {
  const params = useParams<{ id: string }>();
  const eateryId = params?.id ?? '';
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const dishesQuery = useFoodControllerDishes(eateryId, {
    query: { enabled: eateryId !== '', retry: false },
  });

  const createMutation = useFoodControllerCreateDish({
    mutation: {
      onSuccess: () => {
        setName('');
        setPriceUsd('');
        setPhotoUrl('');
        setCaption('');
        setErrMsg(null);
        void queryClient.invalidateQueries({
          queryKey: getFoodControllerDishesQueryKey(eateryId),
        });
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Report failed.'}`);
      },
    },
  });

  function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setErrMsg(null);
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setErrMsg('Dish name required.');
      return;
    }
    const data: AddDishReportRequestDto = { name: trimmed };
    if (priceUsd.trim().length > 0) {
      const n = Number(priceUsd);
      if (!Number.isFinite(n) || n <= 0) {
        setErrMsg('Price must be a positive number.');
        return;
      }
      data.priceUsd = n;
    }
    if (photoUrl.trim().length > 0) data.photoUrl = photoUrl.trim();
    if (caption.trim().length > 0) data.caption = caption.trim();
    createMutation.mutate({ eateryId, data });
  }

  const dishes = (dishesQuery.data?.data as unknown as ListDishesResponseDto | undefined)?.dishes;
  const apiErr = dishesQuery.error as ApiError | null;
  const missing = apiErr?.status === 404;

  return (
    <main className="space-y-6">
      <p>
        <Link href="/discover" className="text-sm text-muted hover:underline">
          ← Back to discover
        </Link>
      </p>
      <Card>
        <CardHeader>
          <CardTitle>🍽️ Dishes reported here</CardTitle>
          <CardSubtitle>
            Foodie reports — name, price, photo, caption. Newest first. Tap a dish to see details.
          </CardSubtitle>
        </CardHeader>
        {dishesQuery.isLoading ? (
          <ul className="space-y-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </ul>
        ) : missing ? (
          <p className="text-sm text-danger">Eatery not found.</p>
        ) : dishesQuery.isError ? (
          <p className="text-sm text-danger">
            Couldn&apos;t load dishes ({apiErr?.code ?? `HTTP_${apiErr?.status ?? '???'}`}).
          </p>
        ) : !dishes || dishes.length === 0 ? (
          <p className="text-sm text-muted">
            No dishes reported yet. Be the first foodie to log one.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {dishes.map((d: DishDto) => (
              <DishCard key={d.id} dish={d} />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>📝 Report a dish</CardTitle>
          <CardSubtitle>What did you eat? Drop a photo + price for the next foodie.</CardSubtitle>
        </CardHeader>
        {token === null ? (
          <p className="text-sm text-muted">
            <Link href="/login" className="text-brand hover:underline">
              Sign in
            </Link>{' '}
            to report a dish.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <Field
              label="Dish name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Cacio e Pepe"
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Price USD (optional)"
                value={priceUsd}
                onChange={(e) => setPriceUsd(e.target.value)}
                inputMode="decimal"
                placeholder="18.50"
              />
              <Field
                label="Photo URL (optional)"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                maxLength={1024}
                placeholder="https://…"
              />
            </div>
            <label className="block space-y-1">
              <span className="block text-sm font-medium">Caption (optional)</span>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={280}
                rows={2}
                placeholder="Best pasta in town."
                className="block w-full rounded-md border border-muted/30 bg-surface px-3 py-2 text-sm"
              />
              <span className="block text-xs text-muted">{caption.length}/280</span>
            </label>
            {errMsg ? <p className="text-sm text-danger">{errMsg}</p> : null}
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving…' : '🍴 Report this dish'}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}

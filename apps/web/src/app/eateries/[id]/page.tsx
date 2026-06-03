/**
 * V.UX.20 — eatery detail page for the foodie persona. Public-read
 * dish list (anyone can browse) + auth-gated "report a dish" form
 * (name, priceUsd, photoUrl, caption). Anonymous visitors see a
 * sign-in nudge instead of the form.
 *
 * Installed by prompt [V.UX.20]; restyled into the v2 ("Fusion")
 * design language (royal/gold tokens, font-display, cinematic header).
 */
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, NotebookPen, UtensilsCrossed } from 'lucide-react';
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

// Gold-tokened field className shared by the report-a-dish inputs.
const FIELD =
  'rounded-lg border border-gold-600/25 bg-surface px-3.5 py-2.5 text-sm text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25';

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
    <main className="space-y-8">
      {/* Cinematic royal header band — matches /home + /trips. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <Link
          href="/discover"
          className="relative inline-flex items-center gap-1.5 text-xs font-medium text-white/65 underline-offset-4 transition hover:text-gold-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Back to discover
        </Link>
        <p className="relative mt-4 inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <UtensilsCrossed aria-hidden className="h-3.5 w-3.5" /> Foodie field notes
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Dishes reported here
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Real plates from real diners — name, price, photo, caption. Newest first.
        </p>
      </header>

      <Card depth="raised">
        <CardHeader>
          <CardTitle>On the menu</CardTitle>
          <CardSubtitle>
            Foodie reports — name, price, photo, caption. Tap a dish to see details.
          </CardSubtitle>
        </CardHeader>
        {dishesQuery.isLoading ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </ul>
        ) : missing ? (
          <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            Eatery not found.
          </p>
        ) : dishesQuery.isError ? (
          <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            Couldn&apos;t load dishes ({apiErr?.code ?? `HTTP_${apiErr?.status ?? '???'}`}).
          </p>
        ) : !dishes || dishes.length === 0 ? (
          <p className="rounded-2xl border border-gold-600/15 bg-gold-500/5 px-4 py-3 text-sm text-muted">
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

      <Card depth="raised">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <NotebookPen aria-hidden className="h-5 w-5 text-gold-600" /> Report a dish
          </CardTitle>
          <CardSubtitle>What did you eat? Drop a photo + price for the next foodie.</CardSubtitle>
        </CardHeader>
        {token === null ? (
          <p className="rounded-2xl border border-gold-600/15 bg-gold-500/5 px-4 py-3 text-sm text-muted">
            <Link
              href="/login"
              className="font-medium text-gold-700 underline-offset-4 transition hover:underline dark:text-gold-300"
            >
              Sign in
            </Link>{' '}
            to report a dish.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field
              label="Dish name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Cacio e Pepe"
              required
              className={FIELD}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Price USD (optional)"
                value={priceUsd}
                onChange={(e) => setPriceUsd(e.target.value)}
                inputMode="decimal"
                placeholder="18.50"
                className={FIELD}
              />
              <Field
                label="Photo URL (optional)"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                maxLength={1024}
                placeholder="https://…"
                className={FIELD}
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
                className={`block w-full ${FIELD}`}
              />
              <span className="block text-xs text-muted">{caption.length}/280</span>
            </label>
            {errMsg ? (
              <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
                {errMsg}
              </p>
            ) : null}
            <Button type="submit" variant="royal" loading={createMutation.isPending}>
              {createMutation.isPending ? 'Saving…' : 'Report this dish'}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}

/**
 * Public memory-book viewer — `/memory-books/:id`. The api route is
 * `@Public()` so unauthenticated callers (and the auth-less Featured
 * page) can hit it. Returns book metadata + the list of attached asset
 * ids; each tile resolves its own presigned URL via
 * `GET /memory-books/public/:id/assets/:assetId/download-url` and
 * renders an `<img>` once the URL lands. The placeholder stays put on
 * loading / error so a single broken asset can't take down the grid.
 *
 * Installed by prompt [IV.18.19.48]; thumbnail rendering [IV.18.19.50].
 */
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  useMemoryBookControllerGetPublic,
  useMemoryBookControllerGetPublicAssetDownloadUrl,
  type PublicDownloadUrlResponseDto,
  type PublicMemoryBookDto,
  type PublicMemoryBookWithAssetsResponseDto,
} from '@app/sdk';
import { Badge } from '../../../components/ui/badge';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function PublicMemoryBookPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const { data, isLoading, isError, error } = useMemoryBookControllerGetPublic(id, {
    query: { enabled: id !== '', retry: false },
  });

  if (isLoading) {
    return (
      <main className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </main>
    );
  }

  if (isError) {
    const e = error as ApiError;
    const missing = e.status === 404;
    return (
      <main className="space-y-4">
        <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {missing
            ? 'This memory book was unpublished or never existed.'
            : `Couldn't load book (${e.code ?? `HTTP_${e.status ?? '???'}`}). ${e.message ?? ''}`}
        </p>
        <p>
          <Link href="/featured" className="text-sm text-muted hover:underline">
            ← Featured
          </Link>
        </p>
      </main>
    );
  }

  const body = data?.data as unknown as PublicMemoryBookWithAssetsResponseDto;
  const book: PublicMemoryBookDto = body.book;
  const assetIds: readonly string[] = body.assetIds ?? [];
  const coverKey = book.coverS3Key as unknown as string | null;

  return (
    <main className="space-y-6">
      <p>
        <Link href="/featured" className="text-sm text-muted hover:underline">
          ← Featured
        </Link>
      </p>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{book.title}</CardTitle>
              <CardSubtitle>
                Published {new Date(book.publishedAt).toLocaleDateString()} · {assetIds.length}{' '}
                {assetIds.length === 1 ? 'asset' : 'assets'}
              </CardSubtitle>
            </div>
            <Badge variant="brand">{book.theme}</Badge>
          </div>
        </CardHeader>
        {coverKey ? (
          <p className="mt-2 text-xs text-muted">
            Cover: <code className="break-all font-mono text-[10px]">{coverKey}</code>
          </p>
        ) : null}
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle>Assets</CardTitle>
            <Badge variant="neutral">{assetIds.length}</Badge>
          </div>
        </CardHeader>
        {assetIds.length === 0 ? (
          <p className="text-sm text-muted">This book has no attached assets yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {assetIds.map((aid) => (
              <AssetThumb key={aid} bookId={id} assetId={aid} />
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}

function AssetThumb({ bookId, assetId }: { bookId: string; assetId: string }) {
  const { data, isLoading, isError } = useMemoryBookControllerGetPublicAssetDownloadUrl(
    bookId,
    assetId,
    { query: { retry: false, staleTime: 60_000 } },
  );
  const url = (data?.data as unknown as PublicDownloadUrlResponseDto | undefined)?.url ?? null;

  return (
    <li className="flex flex-col rounded border border-muted/15 bg-muted/5 p-2 text-xs">
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded bg-muted/20">
        {url ? (
          <img
            src={url}
            alt={`Asset ${assetId.slice(0, 8)}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-2xl" aria-label={isError ? 'failed to load' : 'loading'}>
            {isLoading ? '…' : isError ? '⚠️' : '🖼️'}
          </span>
        )}
      </div>
      <p className="mt-1 truncate font-mono text-[10px] text-muted">{assetId.slice(0, 8)}…</p>
    </li>
  );
}

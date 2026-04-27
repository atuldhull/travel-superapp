/**
 * Public memory-book viewer — `/memory-books/:id`. The api route is
 * `@Public()` so unauthenticated callers (and the auth-less Featured
 * page) can hit it. Returns book metadata + the list of attached asset
 * ids; each tile resolves its own presigned URL via
 * `GET /memory-books/public/:id/assets/:assetId/download-url` and
 * renders an `<img>` once the URL lands. The placeholder stays put on
 * loading / error so a single broken asset can't take down the grid.
 *
 * V.UX.11 enrichments: per-asset captions (rendered below thumbs in
 * grid mode, layered as descriptions in story mode + lightbox), a
 * grid↔story toggle, full-screen lightbox via
 * `yet-another-react-lightbox`, social-share row (Web Share API +
 * Twitter / WhatsApp / copy), and a "Plan a similar trip" CTA.
 *
 * Installed by prompt [IV.18.19.48]; thumbnails [IV.18.19.50]; story
 * + share polish [V.UX.11].
 */
'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  useMemoryBookControllerGetPublic,
  useMemoryBookControllerGetPublicAssetDownloadUrl,
  type MemoryBookAssetSummaryDto,
  type PublicDownloadUrlResponseDto,
  type PublicMemoryBookDto,
  type PublicMemoryBookWithAssetsResponseDto,
} from '@app/sdk';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import { SocialShare } from '../../../components/memory-book/social-share';
import type { LightboxSlide } from '../../../components/memory-book/lightbox';

const MemoryBookLightbox = dynamic(
  () => import('../../../components/memory-book/lightbox').then((m) => m.MemoryBookLightbox),
  { ssr: false },
);

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

type Mode = 'grid' | 'story';

export default function PublicMemoryBookPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const [mode, setMode] = useState<Mode>('grid');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});

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
  const assets: readonly MemoryBookAssetSummaryDto[] = body.assets ?? [];

  const readingMinutes = useMemo(() => {
    const captionWords = assets.reduce(
      (sum, a) =>
        sum +
        ((a.caption as unknown as string | null) ?? '').trim().split(/\s+/).filter(Boolean).length,
      0,
    );
    const fromCaptions = captionWords / 250;
    const fromAssets = (assets.length * 0.25) / 60;
    return Math.max(1, Math.ceil(fromCaptions + fromAssets));
  }, [assets]);

  const lightboxSlides: LightboxSlide[] = assets
    .map((a) => ({
      src: resolvedUrls[a.id] ?? '',
      caption: (a.caption as unknown as string | null) ?? null,
    }))
    .filter((s): s is LightboxSlide => s.src !== '');

  function handleAssetUrlResolved(assetId: string, url: string) {
    setResolvedUrls((prev) => (prev[assetId] === url ? prev : { ...prev, [assetId]: url }));
  }

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <main className="space-y-6">
      <p>
        <Link href="/featured" className="text-sm text-muted hover:underline">
          ← Featured
        </Link>
      </p>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{book.title}</CardTitle>
              <CardSubtitle>
                Published {new Date(book.publishedAt).toLocaleDateString()} · {assets.length}{' '}
                {assets.length === 1 ? 'asset' : 'assets'} · ~{readingMinutes} min read
              </CardSubtitle>
            </div>
            <Badge variant="brand">{book.theme}</Badge>
          </div>
        </CardHeader>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href={`/trips/new?title=${encodeURIComponent(book.title)}` as never}
            className="inline-flex items-center gap-1 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-sm transition hover:opacity-90"
          >
            ✨ Plan a similar trip
          </Link>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMode((m) => (m === 'grid' ? 'story' : 'grid'))}
          >
            {mode === 'grid' ? '📖 Story mode' : '🔲 Grid mode'}
          </Button>
        </div>
        <div className="mt-3 border-t border-muted/15 pt-3">
          <SocialShare title={book.title} text={`Memory book: ${book.title}`} url={shareUrl} />
        </div>
      </Card>
      {assets.length === 0 ? (
        <p className="text-sm text-muted">This book has no attached assets yet.</p>
      ) : mode === 'grid' ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {assets.map((a, idx) => (
            <AssetThumb
              key={a.id}
              bookId={id}
              asset={a}
              onUrlResolved={handleAssetUrlResolved}
              onClick={() => setLightboxIdx(idx)}
            />
          ))}
        </ul>
      ) : (
        <ol className="space-y-6">
          {assets.map((a, idx) => (
            <StoryFrame
              key={a.id}
              bookId={id}
              asset={a}
              index={idx + 1}
              total={assets.length}
              onUrlResolved={handleAssetUrlResolved}
              onClick={() => setLightboxIdx(idx)}
            />
          ))}
        </ol>
      )}
      <MemoryBookLightbox
        open={lightboxIdx !== null}
        index={lightboxIdx ?? 0}
        slides={lightboxSlides}
        onClose={() => setLightboxIdx(null)}
        onIndexChange={(i) => setLightboxIdx(i)}
      />
    </main>
  );
}

interface AssetTileProps {
  readonly bookId: string;
  readonly asset: MemoryBookAssetSummaryDto;
  readonly onUrlResolved: (assetId: string, url: string) => void;
  readonly onClick?: () => void;
}

function AssetThumb({ bookId, asset, onUrlResolved, onClick }: AssetTileProps) {
  const url = useResolvedAssetUrl(bookId, asset.id, onUrlResolved);
  const caption = (asset.caption as unknown as string | null) ?? null;
  return (
    <li className="flex flex-col rounded-md border border-muted/15 bg-muted/5 p-2 text-xs">
      <button
        type="button"
        onClick={onClick}
        className="relative flex aspect-square items-center justify-center overflow-hidden rounded-sm bg-muted/20 transition hover:opacity-90"
        aria-label={caption ?? `Open asset ${asset.id.slice(0, 8)}`}
      >
        {url.src ? (
          <img
            src={url.src}
            alt={caption ?? `Asset ${asset.id.slice(0, 8)}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-2xl" aria-label={url.error ? 'failed to load' : 'loading'}>
            {url.loading ? '…' : url.error ? '⚠️' : '🖼️'}
          </span>
        )}
      </button>
      {caption ? <p className="mt-1.5 line-clamp-2 text-muted">{caption}</p> : null}
    </li>
  );
}

interface StoryFrameProps extends AssetTileProps {
  readonly index: number;
  readonly total: number;
}

function StoryFrame({ bookId, asset, index, total, onUrlResolved, onClick }: StoryFrameProps) {
  const url = useResolvedAssetUrl(bookId, asset.id, onUrlResolved);
  const caption = (asset.caption as unknown as string | null) ?? null;
  return (
    <li className="overflow-hidden rounded-lg border border-muted/15 bg-surface">
      <button
        type="button"
        onClick={onClick}
        className="block w-full bg-muted/10"
        aria-label={caption ?? `Open story frame ${index} of ${total}`}
      >
        <div className="relative flex min-h-[40vh] items-center justify-center sm:min-h-[60vh]">
          {url.src ? (
            <img
              src={url.src}
              alt={caption ?? `Asset ${asset.id.slice(0, 8)}`}
              className="max-h-[70vh] w-full object-contain"
              loading="lazy"
            />
          ) : (
            <span className="text-4xl">{url.loading ? '…' : url.error ? '⚠️' : '🖼️'}</span>
          )}
        </div>
      </button>
      <div className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
        <p className="flex-1 leading-relaxed">
          {caption ?? <span className="italic text-muted/70">(no caption)</span>}
        </p>
        <span className="font-mono text-[10px] text-muted">
          {index} / {total}
        </span>
      </div>
    </li>
  );
}

interface ResolvedUrl {
  readonly src: string | null;
  readonly loading: boolean;
  readonly error: boolean;
}

function useResolvedAssetUrl(
  bookId: string,
  assetId: string,
  onUrlResolved: (assetId: string, url: string) => void,
): ResolvedUrl {
  const { data, isLoading, isError } = useMemoryBookControllerGetPublicAssetDownloadUrl(
    bookId,
    assetId,
    { query: { retry: false, staleTime: 60_000 } },
  );
  const url = (data?.data as unknown as PublicDownloadUrlResponseDto | undefined)?.url ?? null;
  // Push the resolved URL up to the parent on every render that gets
  // a new value — useEffect keeps the parent state in sync without
  // mutating during render.
  useEffect(() => {
    if (url) onUrlResolved(assetId, url);
    // onUrlResolved is stable from the parent; we don't need to
    // re-run when its identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId, url]);
  return { src: url, loading: isLoading, error: isError };
}

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
 * V.UX.12 preview mode: when `?preview=true`, swap the public read
 * + public-asset-download hooks for their owner-gated equivalents
 * so the editor can preview unpublished drafts. Theme variables are
 * applied via inline `style` on the root, and a `postMessage`
 * listener lets the parent editor swap them in real time without a
 * reload.
 *
 * Installed by prompt [IV.18.19.48]; thumbnails [IV.18.19.50]; story
 * + share polish [V.UX.11]; preview mode [V.UX.12].
 */
'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  useMediaControllerDownloadUrl,
  useMemoryBookControllerGetOne,
  useMemoryBookControllerGetPublic,
  useMemoryBookControllerGetPublicAssetDownloadUrl,
  type MediaDownloadUrlResponseDto,
  type MemoryBookAssetSummaryDto,
  type MemoryBookWithAssetsResponseDto,
  type PublicDownloadUrlResponseDto,
  type PublicMemoryBookWithAssetsResponseDto,
} from '@app/sdk';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import { SocialShare } from '../../../components/memory-book/social-share';
import { getThemeBySlug } from '../../../components/memory-book/theme-picker';
import type { LightboxSlide } from '../../../components/memory-book/lightbox';
import { useAuthBootComplete, useAuthToken } from '../../../lib/use-auth-token';

const MemoryBookLightbox = dynamic(
  () => import('../../../components/memory-book/lightbox').then((m) => m.MemoryBookLightbox),
  { ssr: false },
);

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

type Mode = 'grid' | 'story';

interface NormalizedBook {
  readonly id: string;
  readonly title: string;
  readonly theme: string;
  readonly publishedAt: string | null;
}

interface ThemeOverride {
  readonly accent: string;
  readonly bg: string;
}

export default function PublicMemoryBookPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = params?.id ?? '';
  const preview = search?.get('preview') === 'true';

  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();

  const [mode, setMode] = useState<Mode>('grid');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const [themeOverride, setThemeOverride] = useState<ThemeOverride | null>(null);

  // Always call BOTH hooks so React's hook-call order stays stable;
  // gate them with `enabled` so only the relevant request actually
  // fires.
  const publicQ = useMemoryBookControllerGetPublic(id, {
    query: { enabled: id !== '' && !preview, retry: false },
  });
  const ownerQ = useMemoryBookControllerGetOne(id, {
    query: { enabled: id !== '' && preview && token !== null, retry: false },
  });

  // Listen for parent-editor theme broadcasts (V.UX.12). Same-origin
  // only; ignore any cross-origin messages.
  useEffect(() => {
    if (!preview) return;
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; accent?: string; bg?: string } | null;
      if (!data || data.type !== 'memory-book-theme') return;
      if (typeof data.accent !== 'string' || typeof data.bg !== 'string') return;
      setThemeOverride({ accent: data.accent, bg: data.bg });
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [preview]);

  const isLoading = preview
    ? !bootComplete || (token !== null && ownerQ.isLoading)
    : publicQ.isLoading;
  const isError = preview ? ownerQ.isError : publicQ.isError;
  const error = preview ? ownerQ.error : publicQ.error;

  // Pull the active record into a unified shape so the JSX
  // downstream doesn't have to branch on source.
  const previewBody = ownerQ.data?.data as unknown as MemoryBookWithAssetsResponseDto | undefined;
  const publicBody = publicQ.data?.data as unknown | undefined as
    | PublicMemoryBookWithAssetsResponseDto
    | undefined;

  const normalizedBook: NormalizedBook | null = useMemo(() => {
    if (preview && previewBody) {
      return {
        id: previewBody.book.id,
        title: previewBody.book.title,
        theme: previewBody.book.theme,
        publishedAt: (previewBody.book.publishedAt as unknown as string | null) ?? null,
      };
    }
    if (!preview && publicBody) {
      return {
        id: publicBody.book.id,
        title: publicBody.book.title,
        theme: publicBody.book.theme,
        publishedAt: publicBody.book.publishedAt,
      };
    }
    return null;
  }, [preview, previewBody, publicBody]);

  const assets: readonly MemoryBookAssetSummaryDto[] = useMemo(
    () => (preview ? (previewBody?.assets ?? []) : (publicBody?.assets ?? [])),
    [preview, previewBody, publicBody],
  );

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

  const themeStyle = useMemo(() => {
    const t = themeOverride ?? getThemeBySlug(normalizedBook?.theme ?? 'classic');
    return {
      backgroundColor: t.bg,
      borderTop: `4px solid ${t.accent}`,
    } as React.CSSProperties;
  }, [themeOverride, normalizedBook?.theme]);

  if (preview && bootComplete && token === null) {
    return (
      <main className="space-y-4">
        <p className="rounded-2xl border border-gold-600/30 bg-gold-500/5 px-4 py-3 text-sm text-surface-foreground">
          Preview requires you to be signed in as the owner.
        </p>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="space-y-4">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </main>
    );
  }

  if (isError) {
    const e = error as ApiError;
    const missing = e?.status === 404;
    return (
      <main className="space-y-4">
        <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {missing
            ? preview
              ? "We couldn't find this draft to preview."
              : 'This memory book was unpublished or never existed.'
            : `Couldn't load book (${e?.code ?? `HTTP_${e?.status ?? '???'}`}). ${e?.message ?? ''}`}
        </p>
        {!preview ? (
          <p>
            <Link
              href="/featured"
              className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 transition hover:text-gold-600 hover:underline"
            >
              <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Featured
            </Link>
          </p>
        ) : null}
      </main>
    );
  }

  if (!normalizedBook) return null;

  function handleAssetUrlResolved(assetId: string, url: string) {
    setResolvedUrls((prev) => (prev[assetId] === url ? prev : { ...prev, [assetId]: url }));
  }

  const lightboxSlides: LightboxSlide[] = assets
    .map((a) => ({
      src: resolvedUrls[a.id] ?? '',
      caption: (a.caption as unknown as string | null) ?? null,
    }))
    .filter((s): s is LightboxSlide => s.src !== '');

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <main className="space-y-6 rounded-md p-4 transition-colors" style={themeStyle}>
      {preview ? (
        <p className="rounded-md border border-brand/30 bg-brand/10 px-3 py-2 text-xs">
          🔍 Preview mode — only you can see this. Publish from the editor when you're ready.
        </p>
      ) : (
        <p>
          <Link href="/featured" className="text-sm text-muted hover:underline">
            ← Featured
          </Link>
        </p>
      )}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{normalizedBook.title}</CardTitle>
              <CardSubtitle>
                {normalizedBook.publishedAt ? (
                  <>Published {new Date(normalizedBook.publishedAt).toLocaleDateString()} · </>
                ) : (
                  <>Draft · </>
                )}
                {assets.length} {assets.length === 1 ? 'asset' : 'assets'} · ~{readingMinutes} min
                read
              </CardSubtitle>
            </div>
            <Badge variant="brand">{normalizedBook.theme}</Badge>
          </div>
        </CardHeader>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href={`/trips/new?title=${encodeURIComponent(normalizedBook.title)}` as never}
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
        {!preview ? (
          <div className="mt-3 border-t border-muted/15 pt-3">
            <SocialShare
              title={normalizedBook.title}
              text={`Memory book: ${normalizedBook.title}`}
              url={shareUrl}
            />
          </div>
        ) : null}
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
              preview={preview}
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
              preview={preview}
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
  readonly preview: boolean;
  readonly onUrlResolved: (assetId: string, url: string) => void;
  readonly onClick?: () => void;
}

function AssetThumb({ bookId, asset, preview, onUrlResolved, onClick }: AssetTileProps) {
  const url = useResolvedAssetUrl(bookId, asset.id, preview, onUrlResolved);
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

function StoryFrame({
  bookId,
  asset,
  preview,
  index,
  total,
  onUrlResolved,
  onClick,
}: StoryFrameProps) {
  const url = useResolvedAssetUrl(bookId, asset.id, preview, onUrlResolved);
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
  preview: boolean,
  onUrlResolved: (assetId: string, url: string) => void,
): ResolvedUrl {
  // Hooks must be called unconditionally — gate via `enabled` so
  // only one hits the wire per call site.
  const publicQ = useMemoryBookControllerGetPublicAssetDownloadUrl(bookId, assetId, {
    query: { enabled: !preview, retry: false, staleTime: 60_000 },
  });
  const ownerQ = useMediaControllerDownloadUrl(assetId, {
    query: { enabled: preview, retry: false, staleTime: 60_000 },
  });

  const publicUrl =
    (publicQ.data?.data as unknown as PublicDownloadUrlResponseDto | undefined)?.url ?? null;
  const ownerUrl =
    (ownerQ.data?.data as unknown as MediaDownloadUrlResponseDto | undefined)?.url ?? null;

  const url = preview ? ownerUrl : publicUrl;
  const isLoading = preview ? ownerQ.isLoading : publicQ.isLoading;
  const isError = preview ? ownerQ.isError : publicQ.isError;

  useEffect(() => {
    if (url) onUrlResolved(assetId, url);
    // onUrlResolved is stable from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId, url]);

  return { src: url, loading: isLoading, error: isError };
}

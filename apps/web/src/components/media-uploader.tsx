/**
 * Three-step media uploader:
 *
 *   1. POST /media/upload-url — receive { mediaAssetId, uploadUrl }
 *   2. PUT to the presigned S3 URL with the file bytes
 *   3. POST /media/:id/confirm — flip status to `ready`
 *
 * The api creates the row pre-attached to the trip when `tripId` is
 * passed in step 1, so no separate /media/:id/trip PATCH is needed
 * for the happy path.
 *
 * Direct fetch for step 2 (raw S3 PUT) — no Authorization header,
 * no /api prefix. Uses the URL the api hands back; on failure we
 * surface the network error inline and the asset row stays in
 * `processing` (orphan-sweep cron eventually purges it).
 *
 * Installed by prompt [IV.18.19.43].
 */
'use client';

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getMediaControllerListByTripQueryKey,
  useMediaControllerConfirm,
  useMediaControllerCreateUploadUrl,
  type CreateUploadUrlRequestDto,
  type CreateUploadUrlResponseDto,
} from '@app/sdk';
import { Button } from './ui/button';

interface MediaUploaderProps {
  readonly tripId: string;
  readonly onUploaded?: () => void;
}

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export function MediaUploader({ tripId, onUploaded }: MediaUploaderProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const createUploadUrl = useMediaControllerCreateUploadUrl();
  const confirmUpload = useMediaControllerConfirm();

  async function handleFile(file: File) {
    setBusy(true);
    setErrMsg(null);
    try {
      const kind: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';
      const data: CreateUploadUrlRequestDto = {
        kind,
        contentType: file.type || 'application/octet-stream',
        tripId,
      };
      const step1 = (await createUploadUrl.mutateAsync({ data })) as { data?: unknown };
      const body = step1.data as CreateUploadUrlResponseDto;

      const putRes = await fetch(body.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': data.contentType },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`S3 PUT failed: HTTP ${putRes.status}`);
      }

      await confirmUpload.mutateAsync({ id: body.mediaAssetId });

      await queryClient.invalidateQueries({
        queryKey: getMediaControllerListByTripQueryKey(tripId, { limit: '50' }),
      });
      onUploaded?.();
    } catch (err: unknown) {
      const e = err as ApiError;
      setErrMsg(`${e.code ?? 'UPLOAD_FAILED'} — ${e.message ?? 'Unknown error.'}`);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
        className="block w-full text-xs text-muted file:mr-3 file:rounded file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand-foreground hover:file:opacity-90 disabled:opacity-50"
      />
      {errMsg ? (
        <p className="rounded border border-danger/30 bg-danger/5 px-2 py-1 text-xs text-danger">
          {errMsg}
        </p>
      ) : busy ? (
        <p className="text-xs text-muted">Uploading…</p>
      ) : (
        <p className="text-xs text-muted">
          Pick an image or video to attach to this trip. Direct-to-S3, no proxy.
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => fileInputRef.current?.click()}
      >
        {busy ? 'Uploading…' : 'Choose file'}
      </Button>
    </div>
  );
}

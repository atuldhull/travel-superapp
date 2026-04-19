# media-service contract

> Node 22 worker using Sharp (images) and ffmpeg (video) for CPU-bound media transforms. Owns the image/video pipeline end-to-end: EXIF strip → AVIF/WebP encode → thumbnail ladder → 3D-tile caching. Kept out of `apps/api` so a flood of user photo uploads can't starve request-path CPU.
>
> Installed by prompt `[II.7.3]`. See [ADR-002](../../adr/ADR-002-service-extraction-triggers.md) and [context-map §Media](../../architecture/context-map.md).

---

## 1. Transport

**Primary: queue (BullMQ on Redis).** Producers in `apps/api` publish jobs; media-service is one of the consumers on the `media.*` queues. This is the right shape because:

- Every media job is fire-and-forget from the API's perspective — the user's upload completes the moment the raw asset hits S3; transforms happen async.
- Per-job back-pressure + retries are built-in.
- Horizontal scaling = add more consumer pods.

**Secondary: HTTP (internal-only, mTLS).** A single `GET /v1/health` probe + `POST /v1/assets/:id/reprocess` admin endpoint. Not on the hot path.

**No direct HTTP from browser/mobile.** Clients PUT raw assets to a pre-signed S3 URL minted by `apps/api`, then apps/api enqueues the media job. The client never talks to media-service directly.

---

## 2. Queues / Jobs / Endpoints

All job schemas live in `@app/shared-types` and are validated on both enqueue (API) and dequeue (worker) sides. Queue names are namespaced per-env via `@app/cache`.

### Queue: `media.image.transform`

Consumed by the image pipeline. One job per uploaded image.

```ts
export const ImageTransformJob = z.object({
  assetId: z.string().uuid(),
  sourceKey: z.string(), // S3 object key of the raw upload
  userId: z.string(),
  purpose: z.enum(['profile', 'trip-media', 'place-photo', 'memory-book']),
  targets: z
    .array(
      z.object({
        label: z.enum(['thumb-128', 'thumb-512', 'feed-1024', 'full']),
        format: z.enum(['avif', 'webp', 'jpeg']),
        quality: z.number().min(1).max(100).default(80),
      }),
    )
    .min(1),
});
export const ImageTransformResult = z.object({
  assetId: z.string().uuid(),
  outputs: z.array(
    z.object({
      label: z.string(),
      format: z.string(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      bytes: z.number().int().positive(),
      s3Key: z.string(),
      sha256: z.string().length(64),
    }),
  ),
  exifStripped: z.boolean(), // must be true for user-uploaded assets
  processingMs: z.number().int().nonnegative(),
});
```

EXIF **must** be stripped before upload to the public bucket — Playbook §13 PII rule. `exifStripped: false` in the result is a CI-fail invariant (asserted in the worker's Jest tests).

### Queue: `media.video.transcode`

```ts
export const VideoTranscodeJob = z.object({
  assetId: z.string().uuid(),
  sourceKey: z.string(),
  userId: z.string(),
  targets: z
    .array(
      z.object({
        label: z.enum(['preview-480', 'hls-720', 'hls-1080']),
        codec: z.enum(['h264', 'h265', 'av1']),
        maxBitrateKbps: z.number().int().positive(),
      }),
    )
    .min(1),
});
export const VideoTranscodeResult = z.object({
  assetId: z.string().uuid(),
  variants: z.array(
    z.object({
      label: z.string(),
      manifestS3Key: z.string(), // HLS manifest key; player resolves segments relative to this
      durationSeconds: z.number().nonnegative(),
      bytes: z.number().int().positive(),
    }),
  ),
  processingMs: z.number().int().nonnegative(),
});
```

### Queue: `media.3d-tile.cache`

Warms Google 3D Tiles for a given geographic bbox so the mobile 3D preview doesn't fetch live tiles the first time a user opens a city.

```ts
export const TileCacheJob = z.object({
  bbox: z.object({
    minLat: z.number(),
    minLng: z.number(),
    maxLat: z.number(),
    maxLng: z.number(),
  }),
  zoomLevels: z.array(z.number().int().min(8).max(20)).min(1),
  ttlHours: z.number().int().positive().default(720), // 30 days
});
export const TileCacheResult = z.object({
  tilesFetched: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
  processingMs: z.number().int().nonnegative(),
});
```

### `GET /v1/health` (REST, internal)

Returns `{status: "ok", queues: {<name>: {active, waiting, failed}}, cpuPct}`.

### `POST /v1/assets/:id/reprocess` (REST, admin-auth)

Re-enqueues an asset's pipeline. Used when the target ladder changes (e.g. we add AVIF) and we want to backfill.

---

## 3. SLO

Measured per-job, not per-request — queue consumers have a different shape than request/response services.

| Job / endpoint                         | p95 processing time | p99    | Throughput (per pod) | Availability |
| -------------------------------------- | ------------------- | ------ | -------------------- | ------------ |
| `media.image.transform`                | 900 ms              | 3 s    | 120 images/min       | 99.9%        |
| `media.video.transcode` (≤30 s source) | 45 s                | 90 s   | 40 videos/hour       | 99.5%        |
| `media.3d-tile.cache` (per bbox)       | 2 min               | 8 min  | 20 bboxes/hour       | 99%          |
| `/v1/health`                           | 50 ms               | 200 ms | N/A                  | 99.99%       |

**Queue-depth SLO.** Pending jobs on `media.image.transform` must stay below 500 for 95% of any 1-hour window. Breach = auto-scale up (or page, if auto-scaling is capped).

---

## 4. Failure / degradation mode

Jobs are **at-least-once** by BullMQ default, so every consumer MUST be idempotent:

- `ImageTransformJob`: output S3 keys are `sha256(assetId+label+format)` — a re-run that produces the same bytes writes the same key and is a no-op.
- `VideoTranscodeJob`: same deterministic key strategy on the HLS manifest.
- `TileCacheJob`: S3 key is `sha256(bbox+zoom+tileId)` — identical.

**Retry policy.** BullMQ exponential backoff: 1s / 5s / 25s / 2min / 10min. After 5 failed attempts, job moves to the `media.*.dlq` and an alert fires.

**Failure modes + fallbacks.**

| Failure                              | Detection                                             | Fallback                                                                                                                  |
| ------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Sharp / ffmpeg process OOM           | Worker exits, BullMQ marks job `failed`.              | Retry at lower quality tier (single attempt). If that fails, DLQ + user gets the original in feeds.                       |
| S3 write 5xx                         | SDK retries exhausted.                                | BullMQ retry. DLQ after 5. `MediaUploadFailed` event fires so Trip / Social unsubscribe from ETA.                         |
| Corrupt / unreadable source          | Sharp probe fails at job start.                       | Job moves straight to DLQ with `DECODE_FAILED`. Asset flagged in DB as `status=invalid`.                                  |
| media-service pod down / queue empty | BullMQ monitoring + `/v1/health` `HttpPingIndicator`. | Uploads still succeed — raw asset is in S3. The UI shows the original until a transformed variant exists (lazy-fallback). |
| 3D tile fetch rate-limited by Google | Per-pod 429 counter crosses threshold.                | Circuit breaker opens the tile cache job for 15 min. Mobile falls back to live-fetch with a banner.                       |

**Runbook pointer.** `docs/runbooks/runbook-media-dlq-alarm.md` (to be authored in `[VIII.31.4]`).

**Consumer expectations.** Producers (`apps/api`) MUST:

1. Enqueue media jobs **outside** any `prisma.$transaction` — CLAUDE.md rule 13.
2. Persist an `MediaAsset` row in `status: processing` before enqueuing. The result handler flips it to `ready`; DLQ sets it to `failed`.
3. Never assume a job has been consumed — always subscribe to `MediaUploaded` (published by the worker on success) rather than polling.

---

## Links

- [ADR-002](../../adr/ADR-002-service-extraction-triggers.md) — extraction rationale (CPU isolation).
- [context-map §Media](../../architecture/context-map.md) — Media & Memory context consumes this; publishes `MediaUploaded` on success.
- [ADR-003](../../adr/ADR-003-event-backbone.md) — Redis Streams for cross-context events (what `MediaUploaded` rides on); BullMQ for the job queues this doc covers.
- Prompt `[IV.18.2.x]` — skeleton implementation.

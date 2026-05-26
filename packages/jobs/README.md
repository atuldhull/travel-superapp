# @app/jobs

> Typed BullMQ Queue + Worker factories. **Installed by [Q3]** of the Scale-readiness 3→10 series.

## Why this package exists

Today, every "needs to happen but not on the request path" piece of work runs inline in the request handler. That's fine at low volume but breaks two ways at scale:

1. **Response latency** — push fan-out, image variants, memory-book PDF compose all bring the request to a halt while they finish.
2. **Bursty failure modes** — a Resend outage cascades 5xx onto user requests instead of being retried by a worker out-of-band.

`@app/jobs` is the seam between the request path (`apps/api`) and the workers (`apps/notification-worker`, `apps/media-service`, `apps/crawler-worker`). It wraps [BullMQ](https://docs.bullmq.io/) with:

- A typed `JobPayloads` registry — adding a queue = adding a row, producer + consumer type-check together.
- Cluster-safe key prefix (BullMQ uses `{<queue>}` to pin all of a queue's Redis keys to one slot — see [docs/runbooks/redis-cluster-posture.md](../../docs/runbooks/redis-cluster-posture.md)).
- `maxRetriesPerRequest: null` baked in (BullMQ requires it for blocking ops).
- Sensible default `JobsOptions` — 5 attempts, exponential backoff, age-out completed / failed jobs.

## Producer (apps/api)

```ts
import { makeQueue, type JobPayloads } from '@app/jobs';

const notifications = makeQueue('notifications', process.env.REDIS_URL!);

// later, in a use case:
await notifications.add('email', {
  userId: user.id,
  channel: 'email',
  template: 'welcome',
  vars: { firstName: user.firstName },
});
```

The `Queue` is owned by a Nest provider that implements `OnModuleDestroy` and calls `queue.close()` — the fitness gate from [M1] verifies this.

## Consumer (apps/notification-worker)

```ts
import { makeWorker } from '@app/jobs';

const worker = makeWorker('notifications', {
  redisUrl: process.env.REDIS_URL!,
  concurrency: 10,
  handler: async (job) => {
    const { channel, userId, template, vars } = job.data;
    if (channel === 'email') await emailSender.send(userId, template, vars);
    else if (channel === 'push') await pushSender.send(userId, template, vars);
    else if (channel === 'sms') await smsSender.send(userId, template, vars);
  },
});

process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});
```

## Cluster safety

BullMQ keys are prefixed `{<queue-name>}` automatically — so every key for the `notifications` queue (`{notifications}:wait`, `{notifications}:active`, `{notifications}:failed`, etc.) hashes to one slot. No manual hash-tagging in user code.

If you need a queue per shard (e.g. one per region), the queue NAME carries the shard: `makeQueue('notifications:us-east', ...)` → `{notifications:us-east}:wait`.

## Observability

BullMQ emits events on the `QueueEvents` listener — wire it to `@app/observability` to get `domain_events_total{event="job.completed", queue="<name>"}` for free:

```ts
import { makeQueueEvents } from '@app/jobs';

const events = makeQueueEvents('notifications', process.env.REDIS_URL!);
events.on('completed', ({ jobId }) => metrics.inc('job_completed', { queue: 'notifications' }));
events.on('failed', ({ jobId, failedReason }) =>
  logger.warn({ jobId, failedReason }, 'job_failed'),
);
```

## What's NOT in this package

- **NestJS module decoration.** This package is framework-agnostic. The Nest wrapper lives in `apps/api/src/common/jobs/jobs.module.ts` (producer side) and per-worker `apps/<worker>/src/main.ts` (consumer side).
- **The actual job handlers.** Those live in the worker apps — `@app/jobs` only defines the shape.
- **Distributed locks / rate-limit primitives.** Those live in `apps/api/src/common/rate-limit/` and `apps/api/src/common/locks/` respectively; BullMQ is for "do this once, then forget" work, not for coordinating concurrent runs.

## See also

- [`docs/runbooks/redis-cluster-posture.md`](../../docs/runbooks/redis-cluster-posture.md) — slot routing + cluster migration
- [BullMQ docs](https://docs.bullmq.io/)
- [`packages/clock/`](../clock/) — companion injectable seam for time
- [`packages/resilience/`](../resilience/) — companion package for the request path (CircuitBreaker)

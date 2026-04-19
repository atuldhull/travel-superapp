# notification-worker contract

> NestJS standalone app + BullMQ. Fans every user-facing notification out to FCM / APNs / Expo push, Resend email, and Twilio SMS. Owns quiet-hours, DND preferences, and per-channel retry / DLQ. Extracted from `apps/api` so a push provider outage never blocks the request path.
>
> Installed by prompt `[II.7.3]`. See [ADR-002](../../adr/ADR-002-service-extraction-triggers.md) and [context-map §Notifications](../../architecture/context-map.md).

---

## 1. Transport

**Primary: event subscriptions on the `@app/events` bus (Redis Streams).** The worker is a wildcard subscriber — every published domain event from every other context flows through its dispatcher. Whether an event actually fires a notification depends on a **routing table** that pairs event names with recipient resolvers and channel preferences.

**Secondary: queue (BullMQ).** `apps/api` may enqueue a transactional notification directly (e.g. "password-reset email, now") bypassing the event fan-in. This is the explicit escape hatch — the [context-map](../../architecture/context-map.md) §Notifications row lists it as `NotificationsCommandPort`.

**No HTTP surface** except `/v1/health`. Admin operations (re-delivering a DLQ'd notification, inspecting preferences) land on `apps/admin` via the Notifications port.

---

## 2. Topics / Queues / Endpoints

### Inbound events (subscriptions)

The dispatcher subscribes to **all** events published by every context (see [context-map §Notifications fan-in](../../architecture/context-map.md)). Each event name maps to one or more _notification rules_:

```ts
export const NotificationRule = z.object({
  eventName: z.string(), // e.g. "Safety.SosTriggered"
  channels: z.array(z.enum(['push', 'email', 'sms'])).min(1),
  priority: z.enum(['critical', 'high', 'normal', 'low']),
  quietHoursBypass: z.boolean().default(false), // true only for `critical`
  recipientResolver: z.enum([
    'event.userId', // read userId field off the event payload
    'trip.participants', // resolve all participants of a trip
    'place.watchers', // resolve users subscribed to a place
  ]),
  templateId: z.string(), // lookup key into the template registry
});
```

A match produces one job per `(userId × channel)` on the internal `notifications.send.<channel>` queue.

### Queue: `notifications.send.push` / `.email` / `.sms`

```ts
export const SendNotificationJob = z.object({
  notificationId: z.string().uuid(),
  userId: z.string(),
  channel: z.enum(['push', 'email', 'sms']),
  templateId: z.string(),
  payload: z.record(z.string(), z.unknown()), // template variables
  priority: z.enum(['critical', 'high', 'normal', 'low']),
  idempotencyKey: z.string(), // sha256(eventId + userId + channel) — prevents dupes on event replay
  traceId: z.string(),
});
export const SendNotificationResult = z.object({
  notificationId: z.string().uuid(),
  providerMessageId: z.string().optional(),
  channel: z.string(),
  status: z.enum(['delivered', 'suppressed-quiet-hours', 'suppressed-user-preference', 'failed']),
  attempts: z.number().int().positive(),
  latencyMs: z.number().int().nonnegative(),
});
```

Outbound event on success: `Notifications.NotificationDispatched`.
Outbound event on permanent failure: `Notifications.NotificationFailed`.

### `POST /v1/health` (REST, internal)

`{status: "ok", queues: {...}, providers: {fcm: "ok", apns: "ok", resend: "ok", twilio: "ok"}}`.

### Command port (via BullMQ `notifications.command` queue)

```ts
export const EnqueueTransactionalCommand = z.object({
  userId: z.string(),
  channels: z.array(z.enum(['push', 'email', 'sms'])).min(1),
  templateId: z.string(),
  payload: z.record(z.string(), z.unknown()),
  priority: z.enum(['critical', 'high', 'normal', 'low']),
  idempotencyKey: z.string(),
  traceId: z.string(),
});
```

Password resets, email verification, invoice receipts — anything that must not wait for the event bus — go through this port.

---

## 3. SLO

| Path                                   | p95     | p99     | Availability | Notes                                                           |
| -------------------------------------- | ------- | ------- | ------------ | --------------------------------------------------------------- |
| Event → first channel job enqueued     | 200 ms  | 800 ms  | 99.9%        | From Redis Streams XREAD to BullMQ add.                         |
| Push delivery (FCM/APNs/Expo)          | 5 s     | 15 s    | 99.5%        | Includes provider round trip. Does NOT include device delivery. |
| Email delivery (Resend accepts)        | 2 s     | 6 s     | 99.5%        | Provider accepts ≠ inbox — that's out of our SLO.               |
| SMS delivery (Twilio accepts)          | 3 s     | 10 s    | 99%          | Carrier delivery is best-effort.                                |
| `Safety.SosTriggered` → push delivered | **3 s** | **8 s** | **99.95%**   | Tightest SLO we have. SOS pages a human operator on breach.     |
| `/v1/health`                           | 50 ms   | 200 ms  | 99.99%       |                                                                 |

**Queue-depth SLO.** `notifications.send.push` pending count below 5,000 for 99% of any 1-hour window. A push backlog that size is 10+ minutes of lag for critical events — auto-scale or page.

---

## 4. Failure / degradation mode

Notifications are at-most-once in **user intent** (never double-send) and at-least-once in **transport** (retry on transient failures). Reconciliation via the `idempotencyKey` field.

**Retry policy.** Per channel:

- **push** — 3 attempts, backoff 1s / 10s / 60s. DLQ after 3.
- **email** — 5 attempts, 30s / 2min / 10min / 1h / 6h. DLQ after 5.
- **sms** — 3 attempts, 30s / 5min / 30min. DLQ after 3.

Attempts stop immediately on provider-marked permanent failures (invalid token, bounced address, blocklisted number).

**Failure modes + fallbacks.**

| Failure                          | Detection                                                  | Fallback                                                                                                                                                 |
| -------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Redis Streams consumer stalls    | Pending-entries-list (PEL) depth alarm.                    | Worker restarts via k8s livenessProbe; stream claim reclaims PEL entries on the new consumer.                                                            |
| FCM / APNs / Expo 5xx            | Provider response 5xx.                                     | Exponential retry. If sustained >15 min, circuit opens — failover to email for the same user+event (if email channel exists on the rule).                |
| Resend / Twilio 5xx              | 5xx response.                                              | Retry per above; DLQ after max attempts. No channel-level failover for email/SMS (per Playbook §13.2 — we don't silently reroute PII-carrying messages). |
| Worker pod crashes mid-send      | BullMQ job returns to queue after lock TTL.                | Idempotency key prevents double-send. Re-attempt by the next available worker.                                                                           |
| User's quiet-hours window active | Dispatcher checks `NotificationPreference` before enqueue. | `critical` priority bypasses. Others enqueued for delivery at `quietHoursEnd`.                                                                           |
| Event bus outage                 | Subscription errors surface via observability.             | `NotificationsCommandPort` still works (direct queue). Transactional flows (password reset etc.) stay up.                                                |

**DLQ handling.** Admin dashboard in `apps/admin` lists DLQ'd notifications with their last error + original event. Manual re-drive is supported; one-click "cancel" marks `suppressed-manual` and fires `NotificationFailed` so consumers can react.

**Runbook pointer.** `docs/runbooks/runbook-push-delivery-failure.md` (Playbook §31.4).

**Consumer expectations.** Producers — any module publishing an event that might notify a user — MUST:

1. Include a stable user-scoped id on the event payload so the `recipientResolver` can resolve without a DB round-trip in the hot path.
2. Use domain event names already in the [context-map](../../architecture/context-map.md). Adding a new event means adding a row there first.
3. NOT call the Notifications module directly for event-driven flows. The only direct call is `NotificationsCommandPort` for transactional must-send-now cases.

---

## Links

- [ADR-002](../../adr/ADR-002-service-extraction-triggers.md) — worker extraction rationale.
- [ADR-003](../../adr/ADR-003-event-backbone.md) — Redis Streams is the event transport the dispatcher subscribes to.
- [context-map §Notifications](../../architecture/context-map.md) — fan-in list + command-port row.
- Prompt `[IV.18.2.9]` — module implementation.

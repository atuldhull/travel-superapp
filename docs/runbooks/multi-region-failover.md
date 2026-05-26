# Runbook — Multi-region failover

> **Installed by [Q9]** of the Scale-readiness 3→10 series. Companion to [`docs/runbooks/backups-dr.md`](backups-dr.md) (data DR) + [`docs/runbooks/redis-cluster-posture.md`](redis-cluster-posture.md) + [`docs/runbooks/database-pooling.md`](database-pooling.md).
>
> Multi-region is about **regional availability**, not data DR. A region going dark (Fly outage, cloud-provider AZ failure, BGP route storm) shouldn't black out the app. DR — losing the DB — is a different problem with a different runbook ([backups-dr.md](backups-dr.md)).

## Posture today

| Component               | Single-region today                    | Multi-region after [Q9]                                                         |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------------------------- |
| **apps/api**            | iad only (staging) · iad+lhr (prod)    | Already multi-region in prod (`regions = ["iad", "lhr"]`). DNS via Fly anycast. |
| **Workers (Q4)**        | iad only                               | Spread across the same `var.regions` set (3 workers × N regions = 3N machines). |
| **Postgres (Supabase)** | Single region                          | Read replica on Supabase Team plan ($599/mo) — read-near, write-far.            |
| **Redis (Upstash)**     | Single region (standard tier)          | Upstash Global ($0.30/100k commands) — multi-region active replicas.            |
| **R2 (Cloudflare)**     | Cross-region replica via worker ([N5]) | Already multi-region — R2 is global by default.                                 |
| **DNS (Cloudflare)**    | Anycast                                | Same — no change.                                                               |

`apps/api` is already multi-region in production (the [N3] terraform stack lays a Fly machine per region). [Q9] extends the same posture to the workers and codifies the failover behaviour.

## What multi-region buys us

- **Regional Fly outage tolerance**. iad goes dark → lhr serves; the Fly load balancer routes around the dead region within seconds (anycast).
- **Read latency for users near the second region**. lhr serves EU users at < 80 ms RTT; iad would be 100-150 ms.
- **Worker resilience**. A region-wide network blip can't stall the queue — workers in the surviving region pick up jobs whose visible-timeout expires.

## What it does NOT buy

- **Database resilience**. The Postgres primary is single-region today. A regional Supabase outage takes the DB with it; lhr api machines still can't write. Mitigation: Supabase Team's read replica unblocks READS during a region outage; WRITES need explicit replica-promotion (paid plan + manual operator step).
- **Stripe / Twilio / Resend outage tolerance**. Those are SaaS endpoints (not regional from our view) — failover handled by the [O1] circuit-breakers.
- **Data DR**. Losing all backups is the [`backups-dr.md`](backups-dr.md) playbook; multi-region doesn't help there.

## DNS routing — how requests reach the right region

Cloudflare → Fly anycast does the heavy lifting. The user's DNS resolver returns the nearest Fly edge IP; Fly's edge routes to the nearest healthy machine. A region going dark removes its machines from the load balancer's pool automatically (health checks fail; the edge stops sending traffic).

No DNS changes needed for failover. The runbook below is for the case where Fly's automatic routing is too slow OR where we need manual override.

## Failover procedure — Fly region goes dark

### Symptoms

- One region's machines show `unhealthy` in `flyctl status -a travel-api-prod`.
- p99 spikes from the affected region's users (Honeycomb: group by `fly.region`).
- Cloudflare logs show 522 / 524 from the dead region's path.

### Automatic response (~30 s)

1. Fly health checks fail on the dead region's machines after 3 consecutive failures.
2. Fly's edge stops routing traffic to them.
3. Cloudflare's anycast routing keeps users on the same Fly edge; that edge picks the next-nearest healthy machine.
4. The api in the surviving region absorbs the load. If `min_machines_running = 2` is set (it is in prod), there's already an idle machine ready.

You should see the recovery in the SLO burn-rate dashboard ([`slo-burn-rate.json`](../../ops/observability/grafana/dashboards/slo-burn-rate.json)) within 1-2 minutes — the burn-rate spikes during the cutover, then settles back to ≤ 1× as traffic stabilises on the surviving region.

### Manual response (if automatic isn't enough)

If the dead region is producing back-pressure on the surviving region (5xx spike, OOM, pool exhaustion), scale UP the surviving region:

```sh
# Add 2 more machines in lhr while iad is offline.
flyctl scale count 4 -a travel-api-prod --region lhr
```

Wait for the burn-rate to settle, then scale back down when iad recovers:

```sh
flyctl scale count 2 -a travel-api-prod --region lhr
```

If Fly's region is gone for hours, consider a third region:

```sh
# Add a fresh region the app has never run in.
# 1. Update ops/terraform/envs/production.tfvars: regions = ["iad", "lhr", "syd"]
# 2. tf apply — adds Fly machines in syd.
# 3. Workers will follow via the for-each in workers.tf.
```

Workers' fly.toml `[processes]` shape means they don't auto-start on request like the api — they need explicit scaling per region:

```sh
flyctl scale count 2 -a travel-notification-worker-prod --region lhr
```

## Failover procedure — Supabase region goes dark

This is the harder case. The api on lhr can't reach the iad-region Postgres if iad is the whole zone that died.

### Without a paid read replica

Reads + writes both fail. Mitigation: ride out the outage with cached responses (Cloudflare cache rules from [Q6] keep public reads serving), and accept the writes will fail until Supabase recovers. The status page goes red; users see "Some features unavailable" via a feature-flag toggle.

### With Supabase Team read replica

Reads still work — point the api's read URL at the replica region. Writes still fail (single primary), but the user-perceived blast radius shrinks dramatically.

Steps:

1. Confirm the replica is healthy: Supabase Dashboard → Replicas.
2. Switch reads to the replica:

   ```sh
   # Pull DATABASE_URL_READONLY from Doppler.
   fly secrets set --app travel-api-prod \
     DATABASE_URL_READONLY="$NEW_REPLICA_URL"
   ```

3. Re-roll the surviving region's machines to pick up the new env:

   ```sh
   flyctl deploy --app travel-api-prod --strategy rolling --region lhr
   ```

4. Communicate "writes temporarily disabled" on the status page.
5. When Supabase iad recovers, promote the primary back + revert the env.

The codebase already supports a separate read URL via the `directUrl` pattern from [Q1] — extending it for read replicas is one Prisma `replicas` block away.

## Drill — practice this quarterly

A region you've never failed over from is the region you can't fail over from. Quarterly:

1. Pick a region (say `lhr`).
2. `flyctl machine stop --region lhr -a travel-api-prod` — simulates the region going dark.
3. Watch the SLO burn-rate dashboard. Goal: it spikes briefly then settles within 5 min.
4. After 30 min: `flyctl machine start --region lhr -a travel-api-prod`.
5. Document the drill in `docs/dr-drills/<quarter>-region-failover.md` (next to the existing DR drills from N5).

The drill catches: stale Fly health-check configs, monitor alerting gaps, runbook drift, and the always-funny "we have 2 regions on paper but only 1 region's secrets are synced" failure mode.

## Operator-owed

1. **Verify production has at least 2 regions in `regions` tfvar.** (Prod default is `["iad", "lhr"]`.)
2. **Run the quarterly drill** (procedure above). Append the result to `docs/dr-drills/`.
3. **Supabase Team upgrade** for the read replica path — operator decision tied to availability target.
4. **Upstash Global** if Redis read-near becomes important (~$0.30/100k commands).

## See also

- [`ops/terraform/main.tf`](../../ops/terraform/main.tf) — api Fly machine spread
- [`ops/terraform/workers.tf`](../../ops/terraform/workers.tf) — worker Fly machine spread (Q4 + Q9)
- [`ops/terraform/envs/production.tfvars`](../../ops/terraform/envs/production.tfvars) — production regions list
- [`docs/runbooks/backups-dr.md`](backups-dr.md) — what to do when DATA is lost (not just a region)
- [`docs/runbooks/slo-availability.md`](slo-availability.md) — the pager that fires during a regional outage
- [`docs/perf/capacity-matrix.md`](../perf/capacity-matrix.md) — multi-region is the 10k tier prerequisite

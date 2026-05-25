# Observability — local stack + cloud wire-up ([N1])

## Why this exists

The original setup pointed the OTLP exporter at `http://localhost:4318`
unconditionally, even when nothing was listening — every span emit
became a 404, every log a stack trace. **[N1]** fixes that:

- `packages/observability/src/init.ts` now skips SDK startup when
  neither `OTEL_EXPORTER_OTLP_ENDPOINT` nor `HONEYCOMB_API_KEY` is
  set. One warn line instead of a 404 firehose.
- Operators bring tracing online by either spinning up this local
  stack OR setting one of the two env vars to a real destination.

## Local stack (dev + smoke validation)

`$0`, no-key, three containers:

```bash
docker compose -f ops/observability/docker-compose.observability.yml up -d
```

Then:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
pnpm --filter=api dev
```

Open:

| URL                                         | What                              |
| ------------------------------------------- | --------------------------------- |
| http://localhost:3030                       | Grafana — admin / admin           |
| http://localhost:3200                       | Tempo HTTP (Grafana queries here) |
| http://localhost:9090                       | Prometheus                        |
| http://localhost:3030/d/travel-api-overview | The provisioned API dashboard     |

Tear down:

```bash
docker compose -f ops/observability/docker-compose.observability.yml down -v
```

## Cloud wire-up (prod)

Pick ONE of these — both keep the stack at $0 on the free tier.

### Honeycomb (recommended, 20M events / mo free)

```bash
fly secrets set HONEYCOMB_API_KEY=hcaik_… --app travel-api
# Optional — defaults to `${serviceName}-${environment}`
fly secrets set HONEYCOMB_DATASET=travel-prod --app travel-api
```

The exporter automatically retargets to `https://api.honeycomb.io`
with the `x-honeycomb-team` / `x-honeycomb-dataset` headers when
the key is present.

### Grafana Cloud (10k metrics / 50GB logs free)

```bash
fly secrets set OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-…grafana.net/otlp --app travel-api
fly secrets set OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic <base64(instanceId:token)>" --app travel-api
```

(The OTel SDK reads `OTEL_EXPORTER_OTLP_HEADERS` from the env directly
— no code change needed.)

## What's emitted today

Spans (auto-instrumentation, no manual `tracer.startSpan` calls):
http (Fastify), @nestjs/core, Prisma queries, ioredis commands,
undici fetches.

Metrics (`/metrics` Prometheus text format):

| Metric                               | Type      | Labels                |
| ------------------------------------ | --------- | --------------------- |
| `http_request_duration_seconds`      | histogram | method, route, status |
| `cache_hit_total`                    | gauge     | cache                 |
| `cache_miss_total`                   | gauge     | cache                 |
| `domain_events_total`                | counter   | event                 |
| + `prom-client` default Node metrics | various   | —                     |

## Layout

```
ops/observability/
├── README.md                            # this file
├── docker-compose.observability.yml     # local 3-container stack
├── tempo.yaml                           # Tempo single-binary config
├── prometheus.yml                       # scrape targets
└── grafana/
    ├── datasources/datasources.yml      # auto-wires Tempo + Prometheus
    ├── dashboards-config/dashboards.yml # provisioning provider
    └── dashboards/
        └── api-overview.json            # starter dashboard
```

Alert rules live next to this, under `ops/prometheus/rules/` ([N2]).
Adding new dashboards: drop JSON in `grafana/dashboards/` and reload
the container (`docker compose restart grafana`); the provisioner
picks up on a 30s interval.

## Verify (locally)

```bash
# 1. Stack is healthy
curl -fs http://localhost:9090/-/ready                     # Prometheus
curl -fs http://localhost:3200/ready                       # Tempo

# 2. Api emits metrics
curl -s http://localhost:3000/metrics | head

# 3. Prometheus sees the api
curl -s 'http://localhost:9090/api/v1/targets' | grep -o '"travel-api"'

# 4. Traces flow (drive some traffic + check Tempo)
for i in 1 2 3; do curl -s http://localhost:3000/api/v1/health/live > /dev/null; done
curl -s 'http://localhost:3200/api/search?tags=service.name=api' | head -200
```

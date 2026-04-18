# infra/

Local-development infrastructure. Installed by prompt `[IX.32.2]`.

## What's here

| Service                          | URL                      | Credentials (local dev only)                          |
| -------------------------------- | ------------------------ | ----------------------------------------------------- |
| Postgres 16 + PostGIS + pgvector | `localhost:5432`         | `travel / travel_dev / travel_dev`                    |
| Redis 7                          | `localhost:6379`         | password `redis_dev`                                  |
| Meilisearch                      | `http://localhost:7700`  | master key `meili_dev_key_change_me_minimum_16_chars` |
| MinIO API                        | `http://localhost:9000`  | `minio / minio_dev_password`                          |
| MinIO Console                    | `http://localhost:9001`  | same                                                  |
| Mailpit SMTP                     | `localhost:1025`         | —                                                     |
| Mailpit UI                       | `http://localhost:8025`  | —                                                     |
| Jaeger UI                        | `http://localhost:16686` | —                                                     |
| Prometheus                       | `http://localhost:9090`  | —                                                     |
| Grafana                          | `http://localhost:3001`  | `admin / admin`                                       |

> **All credentials above are LOCAL DEV ONLY.** Never reuse them anywhere else. Real secrets live in Doppler (see CLAUDE.md).

## Commands

```bash
# Start everything (detached)
docker compose -f infra/docker-compose.yml up -d

# See status + health
docker compose -f infra/docker-compose.yml ps

# Tail all logs
docker compose -f infra/docker-compose.yml logs -f

# Stop (keeps volumes)
docker compose -f infra/docker-compose.yml down

# Stop + wipe volumes (fresh start)
docker compose -f infra/docker-compose.yml down -v

# Rebuild the postgres image (after changing its Dockerfile / init scripts)
docker compose -f infra/docker-compose.yml build postgres
```

A root-level `Makefile` with `make up / down / reset / db-shell / redis-shell` lands in prompt `[IX.32.3]`.

## Layout

```
infra/
├── docker-compose.yml                          # 8 services, named volumes, healthchecks
├── postgres/
│   ├── Dockerfile                              # postgis + pgvector
│   └── init/
│       └── 01-extensions.sql                   # CREATE EXTENSION postgis, vector, ...
├── prometheus/
│   └── prometheus.yml                          # scrape config (self + api + ai-service)
└── grafana/
    └── provisioning/
        ├── datasources/datasources.yml         # Prometheus + Jaeger datasources
        └── dashboards/
            ├── dashboards.yml                  # provider pointing at ./json/
            └── json/.gitkeep                   # dashboards land in [III.15.7]
```

## First-boot

The first `up -d` builds the postgres image (~1–2 min on first run, cached afterwards) and applies `./postgres/init/01-extensions.sql` which enables `postgis`, `postgis_topology`, `vector`, `pg_trgm`, and `pgcrypto` on the `travel_dev` database.

Subsequent `up -d` starts containers in seconds.

## Verifying extensions

```bash
docker compose -f infra/docker-compose.yml exec postgres \
  psql -U travel -d travel_dev -c "\dx"
```

Should list: `plpgsql`, `postgis`, `postgis_topology`, `vector`, `pg_trgm`, `pgcrypto`.

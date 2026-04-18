-- First-boot initialisation for the travel_dev database.
-- Runs automatically because it lives in /docker-entrypoint-initdb.d/.
-- Installed by prompt [IX.32.2]. Keep idempotent (IF NOT EXISTS).

\connect travel_dev;

-- Geo
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Vector similarity
CREATE EXTENSION IF NOT EXISTS vector;

-- Trigram similarity (place / stay fuzzy matching)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Crypto primitives (PII encryption per Playbook §13.11)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Quick sanity log visible on `docker compose logs postgres`.
DO $$
BEGIN
  RAISE NOTICE 'TravelSuperApp extensions enabled: postgis, postgis_topology, vector, pg_trgm, pgcrypto';
END
$$;

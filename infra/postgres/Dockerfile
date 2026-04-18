# Postgres 16 + PostGIS 3.4 + pgvector.
#
# The upstream postgis/postgis image does not include pgvector, and
# pgvector/pgvector does not include PostGIS. We need both, so we extend
# postgis/postgis and install pgvector via the Debian package (available
# on the PostgreSQL APT repo that is pre-configured in the base image).
#
# Installed by prompt [IX.32.2]. Extensions are enabled at first-boot
# by ./init/01-extensions.sql.

FROM postgis/postgis:16-3.4

RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-16-pgvector \
    && rm -rf /var/lib/apt/lists/*

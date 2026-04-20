-- GiST indexes on every PostGIS `geography(Point, 4326)` column so
-- `ST_DWithin` / `ST_Distance` use the index instead of a seq-scan.
--
-- Prisma can't express `@@index(coordinates, type: Gist)` on columns
-- typed `Unsupported("geography(Point, 4326)")`, so they live here in
-- a hand-edited migration. Playbook §12.2 / §12.4 expect them.
--
-- Installed by prompt [III.12.2] alongside `GeoQueries`.

CREATE INDEX IF NOT EXISTS "Place_coordinates_gist" ON "Place" USING GIST (coordinates);
CREATE INDEX IF NOT EXISTS "Trip_center_gist" ON "Trip" USING GIST (center);
CREATE INDEX IF NOT EXISTS "Stay_coordinates_gist" ON "Stay" USING GIST (coordinates);
CREATE INDEX IF NOT EXISTS "Eatery_coordinates_gist" ON "Eatery" USING GIST (coordinates);
CREATE INDEX IF NOT EXISTS "RouteLeg_origin_gist" ON "RouteLeg" USING GIST (origin);
CREATE INDEX IF NOT EXISTS "RouteLeg_destination_gist" ON "RouteLeg" USING GIST (destination);
CREATE INDEX IF NOT EXISTS "CrimeIncident_coordinates_gist" ON "CrimeIncident" USING GIST (coordinates);
CREATE INDEX IF NOT EXISTS "ScamReport_coordinates_gist" ON "ScamReport" USING GIST (coordinates);
CREATE INDEX IF NOT EXISTS "SosEvent_coordinates_gist" ON "SosEvent" USING GIST (coordinates);
CREATE INDEX IF NOT EXISTS "WeatherForecast_coordinates_gist" ON "WeatherForecast" USING GIST (coordinates);
CREATE INDEX IF NOT EXISTS "Alert_coordinates_gist" ON "Alert" USING GIST (coordinates);
CREATE INDEX IF NOT EXISTS "Event_coordinates_gist" ON "Event" USING GIST (coordinates);
CREATE INDEX IF NOT EXISTS "Geofence_center_gist" ON "Geofence" USING GIST (center);
CREATE INDEX IF NOT EXISTS "MediaAsset_coordinates_gist" ON "MediaAsset" USING GIST (coordinates);

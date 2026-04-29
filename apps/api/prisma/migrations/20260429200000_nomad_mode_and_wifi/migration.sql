-- V.UX.23 — digital-nomad persona: nomadMode pref toggle + posted
-- average wifi speed on Stay listings. Both default-safe so existing
-- rows back-fill without re-quoting upstream providers.
ALTER TABLE "Preferences" ADD COLUMN "nomadMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Stay" ADD COLUMN "wifiSpeedMbps" INTEGER;

-- V.UX.14 — family-mode persona. When enabled, search forms auto-add
-- family filter chips and the trip detail page surfaces a pacing
-- warning when a day has > 4 items. `kidAges` is a flat int[] so we
-- can render age-aware copy ("3 kids aged 5, 7, 10") without a join.

ALTER TABLE "Preferences"
  ADD COLUMN "familyMode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "kidAges" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

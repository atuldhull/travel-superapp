-- V.UX.20 — foodie persona: optional photo + caption on Dish
-- reports. Both nullable; existing rows back-fill to NULL.
ALTER TABLE "Dish" ADD COLUMN "photoUrl" TEXT;
ALTER TABLE "Dish" ADD COLUMN "caption"  TEXT;

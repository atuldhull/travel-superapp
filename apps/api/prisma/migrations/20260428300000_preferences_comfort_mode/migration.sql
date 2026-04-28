-- V.UX.15 — accessibility / senior persona. When enabled, the web
-- client applies a `.comfort` class on `<html>` that bumps font size,
-- line-height, and tap-target padding. Transport searches also bias
-- toward step-free routes.

ALTER TABLE "Preferences"
  ADD COLUMN "comfortMode" BOOLEAN NOT NULL DEFAULT false;

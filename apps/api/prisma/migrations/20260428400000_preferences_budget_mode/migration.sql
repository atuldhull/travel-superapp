-- V.UX.16 — budget-backpacker persona. When budgetMode is on, the
-- search forms hide above-tier listings and /trips/[id] surfaces a
-- "Today: $X / $Y" sticky banner that sums the user's expenses for
-- the day. dailyBudgetUsd is the soft daily target.

ALTER TABLE "Preferences"
  ADD COLUMN "budgetMode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "dailyBudgetUsd" DECIMAL(10, 2);

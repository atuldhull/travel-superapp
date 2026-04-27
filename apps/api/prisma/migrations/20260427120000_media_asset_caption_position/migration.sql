-- V.UX.11: per-asset captions + ordering for memory-book story mode.
-- Both columns nullable + caption optional; existing rows default to
-- position=0 so server-side ordering is deterministic before any
-- explicit edit.
ALTER TABLE "MediaAsset"
  ADD COLUMN "caption" TEXT,
  ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "MediaAsset_memoryBookId_position_idx" ON "MediaAsset"("memoryBookId", "position");

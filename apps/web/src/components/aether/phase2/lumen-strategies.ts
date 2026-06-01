/**
 * Lumen layout strategies — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE478 so native Lumen
 * applies identical time/grid/spiral/wall/mood layouts. This file
 * remains so existing imports keep working.
 */
export {
  LUMEN_LAYOUT_STRATEGIES,
  applyLayoutStrategy,
  isStrategyImplemented,
  layoutByGrid,
  layoutByMoodStub,
  layoutBySpiral,
  layoutByWall,
  layoutStrategyDescription,
  layoutStrategyLabel,
  type LumenLayoutStrategy,
} from '@app/aether-canvas-shared';

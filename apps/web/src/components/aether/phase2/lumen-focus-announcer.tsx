'use client';

/**
 * AE403 — `<LumenFocusAnnouncer>` aria-live overlay.
 *
 * Mounted by the Lumen shell as a visually-hidden but screen-reader-
 * audible `role=status` region. Whenever the focused photo changes,
 * the announcer reads `lumenFocusAnnouncement(focusedId, planes)` so a
 * keyboard-only user knows where they are in the cloud.
 *
 * Pure HTML, no R3F — keeps the announcer testable in jsdom.
 */
import type { CSSProperties } from 'react';
import { useLumenData } from './lumen-data-context';
import { layoutPhotoCloud } from './lumen-cloud';
import { useLumenSelection } from './lumen-selection-context';
import { lumenFocusAnnouncement } from './lumen-keyboard';
import { useMemo } from 'react';

const SR_ONLY: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

export function LumenFocusAnnouncer(): React.ReactElement {
  const { photos } = useLumenData();
  const { focusedId } = useLumenSelection();
  const planes = useMemo(() => layoutPhotoCloud(photos), [photos]);
  const text = useMemo(() => lumenFocusAnnouncement(focusedId, planes), [focusedId, planes]);
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-aether-lumen-focus-announcer
      style={SR_ONLY}
    >
      {text}
    </div>
  );
}

/**
 * I6 (Phase 6) — Apple touch icon. iOS Safari ignores SVG manifest
 * icons, so a real raster icon is needed for "Add to Home Screen".
 *
 * Next's `apple-icon` file convention renders this on demand and
 * auto-injects `<link rel="apple-touch-icon" sizes="180x180">` into
 * every page's <head> — no static PNG to commit, no design tool.
 *
 * Rendered with @vercel/og (Satori) using only plain flexbox divs +
 * `transform` (a rotated square = the compass needle), which Satori
 * renders deterministically without a bundled font.
 */
import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Brand gold gradient — matches manifest + the SVG icons.
        background: 'linear-gradient(135deg, #e9c987 0%, #cdab63 100%)',
      }}
    >
      {/* Compass ring. */}
      <div
        style={{
          width: 104,
          height: 104,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '9px solid #fdfcf9',
          borderRadius: 9999,
        }}
      >
        {/* Needle — a white square rotated 45° reads as a diamond. */}
        <div
          style={{
            width: 40,
            height: 40,
            background: '#fdfcf9',
            transform: 'rotate(45deg)',
          }}
        />
      </div>
    </div>,
    size,
  );
}

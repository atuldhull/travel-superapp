/**
 * /aether/icon — section-specific favicon for the Aether surface.
 *
 * Next 15's `icon.tsx` convention auto-generates a `<link rel="icon">`
 * for routes under this segment. The AetherMark glyph rendered on a
 * terracotta pill mirrors the DriftNav cap so the browser-tab favicon
 * reads as Aether rather than the root app's favicon.
 *
 * Uses `ImageResponse` (Edge runtime) so the icon stays a single
 * shipped file — no extra binary in `public/`.
 */
import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function AetherIcon(): unknown {
  return new ImageResponse(
    <div
      style={{
        width: 32,
        height: 32,
        background: '#C2614A',
        borderRadius: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="#F2E8D5"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="12"
          cy="11"
          r="6.4"
          fill="none"
          stroke="#F2E8D5"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="12" cy="4.5" r="1.4" />
        <path
          d="M 12 17.4 C 13.6 18.6, 15.4 19.0, 16.8 18.4 C 18.0 17.9, 18.4 16.6, 17.4 15.8"
          fill="none"
          stroke="#F2E8D5"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="11" r="1.2" />
      </svg>
    </div>,
    { ...size },
  );
}

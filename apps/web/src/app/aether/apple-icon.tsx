/**
 * /aether/apple-icon — 180×180 Apple touch icon for the Aether
 * surface (iOS home-screen pin). Same composition as `icon.tsx`,
 * scaled up.
 */
import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AetherAppleIcon(): unknown {
  return new ImageResponse(
    <div
      style={{
        width: 180,
        height: 180,
        background: '#C2614A',
        borderRadius: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width="120"
        height="120"
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
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="12" cy="4.5" r="1.2" />
        <path
          d="M 12 17.4 C 13.6 18.6, 15.4 19.0, 16.8 18.4 C 18.0 17.9, 18.4 16.6, 17.4 15.8"
          fill="none"
          stroke="#F2E8D5"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="11" r="1.05" />
      </svg>
    </div>,
    { ...size },
  );
}

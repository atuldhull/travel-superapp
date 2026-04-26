/**
 * Root layout for the App Router. Wraps every page with the basic
 * HTML scaffold + global metadata. Real design system + theme
 * provider land in a follow-up; this is the minimum that lets the
 * route tree mount.
 *
 * Installed by prompt [IV.18.19.14].
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'TravelSuperApp',
  description: 'Mobile-first, AI-powered travel super-app.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          margin: 0,
          padding: '2rem',
          maxWidth: '960px',
          marginInline: 'auto',
        }}
      >
        {children}
      </body>
    </html>
  );
}

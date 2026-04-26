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
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'TravelSuperApp',
  description: 'Mobile-first, AI-powered travel super-app.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-surface text-surface-foreground font-sans antialiased">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}

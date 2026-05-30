/**
 * /aether/destinations/compare?a=jaipur&b=alleppey — side-by-side
 * editorial comparison of two destinations.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CompareLazy } from '@/components/aether/destinations/compare/compare-lazy';
import { aetherOg } from '@/lib/aether-og';

const TITLE = 'Aether · Compare destinations';
const DESC = 'Two roads at a glance. Facts, ledes, accents — side by side.';
export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  robots: { index: false, follow: false },
  ...aetherOg(TITLE, DESC),
};

export default function CompareRoute(): React.ReactElement {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  return <CompareLazy />;
}

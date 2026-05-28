/**
 * /aether/journal — index of all journal articles.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { JournalIndexLazy } from '@/components/aether/journal/journal-index-lazy';

export const metadata: Metadata = {
  title: 'Aether · The Journal',
  description: 'Long-form notes from the road. Field notes, craft stories, pilgrim trails.',
  robots: { index: false, follow: false },
};

export default function JournalIndexRoute(): React.ReactElement {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  return <JournalIndexLazy />;
}

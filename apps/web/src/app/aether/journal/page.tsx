/**
 * /aether/journal — index of all journal articles.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { JournalIndexLazy } from '@/components/aether/journal/journal-index-lazy';
import { aetherOg } from '@/lib/aether-og';

const TITLE = 'Aether · The Journal';
const DESC = 'Long-form notes from the road. Field notes, craft stories, pilgrim trails.';
export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  robots: { index: false, follow: false },
  // AE68 — autodiscovery for feed readers (NetNewsWire, Reeder, etc.)
  alternates: {
    types: {
      'application/rss+xml': '/aether/journal/feed.xml',
      'application/atom+xml': '/aether/journal/feed.atom',
    },
  },
  ...aetherOg(TITLE, DESC, { photoId: '1545048702-79362596cdc9' }),
};

export default function JournalIndexRoute(): React.ReactElement {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  return <JournalIndexLazy />;
}

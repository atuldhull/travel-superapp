'use client';

import dynamic from 'next/dynamic';
import { type JournalArticle } from './data';

const JournalShell = dynamic(async () => (await import('./journal-shell')).JournalShell, {
  ssr: false,
});

export function JournalLazy({ article }: { article: JournalArticle }): React.ReactElement {
  return <JournalShell article={article} />;
}

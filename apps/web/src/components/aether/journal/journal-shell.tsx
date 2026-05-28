'use client';

import { useMemo } from 'react';
import { AetherProvider } from '@app/aether-core';
import { theme as baseTheme, type Theme } from '@app/aether-motion';
import { JournalArticleView } from './journal-article';
import { Pulse } from '../pulse/pulse';
import { type JournalArticle } from './data';

export function JournalShell({ article }: { article: JournalArticle }): React.ReactElement {
  const theme = useMemo<Theme>(
    () =>
      ({
        ...baseTheme,
        font: {
          ...baseTheme.font,
          display: `var(--font-playfair), ${baseTheme.font.display}`,
          ui: `var(--font-inter), ${baseTheme.font.ui}`,
        },
      }) as unknown as Theme,
    [],
  );
  return (
    <AetherProvider premiumTier={null} audioOptOut={false} theme={theme}>
      <JournalArticleView article={article} />
      <Pulse />
    </AetherProvider>
  );
}

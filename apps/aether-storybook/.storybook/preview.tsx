/**
 * Storybook preview — every story renders inside <AetherProvider> so
 * the theme + reduced-motion + premium + audio engine are all live.
 *
 * Storybook environment opts out of audio by default (forceSilent via
 * `audioOptOut`) so visual diffs don't depend on Tone.js boot timing.
 */
import type { Preview } from '@storybook/react';
import { AetherProvider } from '@app/aether-core';
import { theme } from '@app/aether-motion';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'cream',
      values: [
        { name: 'cream', value: theme.color.surface.base },
        { name: 'espresso', value: theme.color.ink.base },
        { name: 'terracotta', value: theme.palette.terracotta.base },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story) => (
      <AetherProvider audioOptOut>
        <Story />
      </AetherProvider>
    ),
  ],
  tags: ['autodocs'],
};

export default preview;

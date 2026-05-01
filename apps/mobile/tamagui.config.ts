/**
 * V.UX.27 — minimal Tamagui config. Imports the v3 default config so
 * we get a working theme + tokens out of the box; can be customised
 * later (brand palette + typography scale).
 *
 * Module augmentation gives the global Tamagui types our config shape
 * — required for `<YStack space="$2">` etc. to typecheck.
 */
import { config } from '@tamagui/config/v3';
import { createTamagui } from 'tamagui';

const tamaguiConfig = createTamagui(config);

export type AppConfig = typeof tamaguiConfig;
declare module 'tamagui' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface TamaguiCustomConfig extends AppConfig {}
}

export default tamaguiConfig;

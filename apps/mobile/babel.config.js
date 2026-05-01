/**
 * Babel config for the Expo 51 + Expo Router + Tamagui shell.
 *
 * - `babel-preset-expo` covers Hermes + Reanimated + JSX.
 * - `react-native-reanimated/plugin` MUST be last (Reanimated docs).
 *
 * Tamagui's optional optimising compiler (`@tamagui/babel-plugin`) is
 * intentionally omitted — it requires a tamagui.config.ts that's been
 * passed through `createTamagui`, which the scaffold sets up but isn't
 * worth the extra plugin chain on day one. Add when bundle-size matters.
 *
 * Installed by prompt [V.UX.27].
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};

import config from '@app/eslint-config';

export default [
  ...config,
  {
    ignores: ['storybook-static/**', 'node_modules/**'],
  },
];

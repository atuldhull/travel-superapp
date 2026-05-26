import config from '@app/eslint-config';

export default [
  ...config,
  {
    ignores: ['dist/**'],
  },
];

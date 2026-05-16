const js = require('@eslint/js');
const globals = require('globals');
const sharedRules = require('../eslint.shared.cjs');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    ignores: ['node_modules/**'],
    languageOptions: {
      globals: { ...globals.node },
      ecmaVersion: 2022,
      sourceType: 'commonjs',
    },
    rules: {
      ...sharedRules,
      'no-console': 'off',
    },
  },
];

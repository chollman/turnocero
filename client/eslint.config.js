import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { createRequire } from 'module';

const sharedRules = createRequire(import.meta.url)('../eslint.shared.cjs');

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // setState inside an effect is valid for syncing derived local state
      'react-hooks/set-state-in-effect': 'off',
      ...sharedRules,
      'no-console': 'warn',
    },
  },
];

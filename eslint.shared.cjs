// Shared ESLint rules used by both client and server configs.
// Keep rules here language-agnostic (no React/Node-specific ones).
module.exports = {
  // Catch-bound errors are often intentionally ignored (we surface the error via
  // a state setter or just swallow it for non-critical paths); `caughtErrors: 'none'`
  // turns off the warning for those without losing it for regular variables.
  'no-unused-vars': [
    'warn',
    {
      varsIgnorePattern: '^_',
      argsIgnorePattern: '^_',
      caughtErrors: 'none',
    },
  ],
  'no-var': 'error',
  'prefer-const': 'warn',
  eqeqeq: ['error', 'smart'],
  'no-duplicate-imports': 'error',
  'no-template-curly-in-string': 'warn',
  'no-self-compare': 'error',
  'no-unreachable-loop': 'error',
  'no-constant-binary-expression': 'error',
  'no-promise-executor-return': 'error',
  'no-throw-literal': 'error',
  'object-shorthand': 'warn',
  'prefer-template': 'warn',
  'prefer-arrow-callback': 'warn',
  'no-useless-rename': 'warn',
  'no-useless-return': 'warn',
  'no-useless-concat': 'warn',
  'no-lonely-if': 'warn',
  'no-else-return': 'warn',
  'dot-notation': 'warn',
  'no-warning-comments': ['warn', { terms: ['todo', 'fixme', 'xxx', 'hack'], location: 'anywhere' }],
};

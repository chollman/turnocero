const js = require("@eslint/js");
const globals = require("globals");
const sharedRules = require("../eslint.shared.cjs");

// Vitest exposes describe/it/expect/vi/beforeEach/etc. as globals when the
// `globals: true` option is set in vitest.config.js. The ESLint config needs
// to know about them so test files don't get flooded with no-undef errors.
const vitestGlobals = {
  describe: "readonly",
  it: "readonly",
  test: "readonly",
  expect: "readonly",
  vi: "readonly",
  beforeAll: "readonly",
  beforeEach: "readonly",
  afterAll: "readonly",
  afterEach: "readonly",
};

module.exports = [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    ignores: ["node_modules/**", "coverage/**"],
    languageOptions: {
      globals: { ...globals.node },
      ecmaVersion: 2022,
      sourceType: "commonjs",
    },
    rules: {
      ...sharedRules,
      "no-console": "off",
    },
  },
  // Vitest config file uses ES modules
  {
    files: ["vitest.config.js"],
    languageOptions: {
      sourceType: "module",
    },
  },
  // Test files get Vitest globals
  {
    files: ["tests/**/*.js", "**/*.test.js"],
    languageOptions: {
      globals: { ...globals.node, ...vitestGlobals },
    },
  },
];

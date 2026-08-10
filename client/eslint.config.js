import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import { createRequire } from "module";

const sharedRules = createRequire(import.meta.url)("../eslint.shared.cjs");

export default [
  { ignores: ["dist/**", "dev-dist/**", "coverage/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      // __COMMIT_COUNT__ is a build-time constant injected via Vite's `define`
      // (see vite.config.js / vitest.config.js) — not a runtime global.
      globals: { ...globals.browser, __COMMIT_COUNT__: "readonly" },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // setState inside an effect is valid for syncing derived local state
      "react-hooks/set-state-in-effect": "off",
      ...sharedRules,
      "no-console": "warn",
    },
  },
  // Vercel Edge middleware — runs on the Edge runtime with Web APIs + process.env.
  {
    files: ["middleware.js"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      sourceType: "module",
    },
    rules: sharedRules,
  },
  // Vitest tests run under Node — grant node globals (e.g. `process`) on top of
  // the browser globals from the src block above.
  {
    files: ["src/**/*.{test,spec}.{js,jsx}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];

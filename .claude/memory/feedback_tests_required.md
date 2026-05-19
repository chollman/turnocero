---
name: tests-required-for-every-new-component-and-method
description: From 2026-05-18 onwards, every new component, route, hook, util, or method ships with its tests in the same change — both client and server. Non-negotiable.
metadata:
  type: feedback
---

## Why
Claudio set this convention on 2026-05-18 after the testing infrastructure backfill (193 server tests + 953 client tests, 81.62% client line coverage, ~40% server line coverage). The test suite exists to be maintained, not bypassed.

## How to apply

When creating or modifying code, ALWAYS include the matching test work in the same response/commit:

| You write… | You also write… |
|---|---|
| A new React component `Foo.jsx` | `Foo.test.jsx` next to it (same folder) |
| A new client utility `bar.js` | `bar.test.js` (utilities go in `client/src/utils/`) |
| A new Express route in `server/routes/*` | Integration test in `server/tests/integration/<area>.test.js` |
| A new server utility, model method, or pure function | Unit test in `server/tests/unit/<area>/<name>.test.js` |
| A new hook (`useFoo.js`) | A test file alongside it covering the main return paths |
| **A bug fix** | A regression test that fails on `main` and passes on the fix |
| **Extending** an existing component/route | Extend its existing `*.test.*` file — never create a parallel one |

## What "ships with tests" means

- The test goes in the same change set (commit, PR) as the code.
- Tests cover the main user-facing behaviour — render, props, error states, key user interactions. Edge cases too when easy; perfect coverage is not required, but "happy path + at least one failure path" is the floor.
- Pure helpers extracted from components (color hashing, formatters, route matchers) belong in `client/src/utils/` and are tested there once instead of per call-site.

## Stack reference

- Both workspaces use **Vitest**. Same syntax client and server.
- Client: `@testing-library/react` + jsdom + MSW v2.
- Server: supertest + `mongodb-memory-server` (each test gets a clean DB).
- See `CLAUDE.md` § Testing for the full layout (helpers, mocks, MSW handlers).
- Run with `npm test` (root), `npm test --prefix client`, `npm test --prefix server`.
- Coverage: `npm run test:coverage` → HTML report at `*/coverage/index.html`.

## Don't

- Don't say "I'll add tests later." Add them now.
- Don't suppress this rule because a change "feels small." Helpers and one-liners are exactly what regression-bites you a year later.
- Don't create new test files when the existing one already covers that component — extend it.
- Don't write tests that only assert "renders without crashing" — at least one assertion about specific text, role, or behavior.

## Supersedes
This replaces the older "No test suite" entry in `feedback_style.md`. The project now has a full test suite as of May 2026.

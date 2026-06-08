#!/usr/bin/env node
// Guard against breakpoint drift — the bug class this whole setup exists to kill.
//
// Background: a Compartidas widget rendered twice in the 941–959px window because
// one component hid its sidebar at 940px while a sibling showed an in-feed copy at
// 959px. The fix was a single canonical scale (src/breakpoints.css) exposed as
// @custom-media tokens (--below-desktop, --desktop, --tablet, --phone, --compact).
//
// This script scans every *.module.css + index.css and FAILS on:
//   1. A reserved canonical value used as a raw @media literal (960/959/880/600/480)
//      — those MUST go through their token so related components stay in lockstep.
//   2. Any @media width in the proven danger gap 941–958px — almost certainly a
//      typo/drift against the 959/960 structural breakpoint.
//
// It only inspects parenthesized media conditions, e.g. `(max-width: 940px)`, which
// occur exclusively inside @media — never as a CSS property — so there are no false
// positives from layout `max-width`/`min-width` declarations.
//
// Run: `npm run lint:breakpoints` (wire into pre-commit alongside ESLint).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../src", import.meta.url));

// Canonical values that now have a token — must not appear as raw @media literals.
const RESERVED = new Map([
  [960, "--desktop"],
  [959, "--below-desktop"],
  [880, "--tablet"],
  [600, "--phone"],
  [480, "--compact"],
]);

// The 940 outlier that caused the original bug also maps to the structural token.
const FOLD_TO_BELOW_DESKTOP = new Set([940]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".module.css") || name === "index.css") out.push(p);
  }
  return out;
}

// Match the parenthesized media condition only (never a bare property).
const COND = /\((?:min|max)-width:\s*(\d+)px\)/g;

const errors = [];
for (const file of walk(SRC)) {
  // breakpoints.css is the single place the literals are allowed (the defs).
  if (file.endsWith("breakpoints.css")) continue;
  const css = readFileSync(file, "utf8");
  const lines = css.split("\n");
  lines.forEach((line, i) => {
    let m;
    COND.lastIndex = 0;
    while ((m = COND.exec(line))) {
      const px = Number(m[1]);
      const where = `${relative(SRC, file)}:${i + 1}`;
      if (RESERVED.has(px)) {
        errors.push(`${where}  →  ${m[0]} debe usar el token (${RESERVED.get(px)})`);
      } else if (FOLD_TO_BELOW_DESKTOP.has(px)) {
        errors.push(`${where}  →  ${m[0]} es drift del quiebre estructural; usá (--below-desktop)`);
      } else if (px >= 941 && px <= 958) {
        errors.push(`${where}  →  ${m[0]} cae en la franja de drift 941–958px; usá (--below-desktop)/(--desktop)`);
      }
    }
  });
}

if (errors.length) {
  console.error("✗ Breakpoints fuera de la escala canónica:\n");
  for (const e of errors) console.error("  " + e);
  console.error(
    `\n${errors.length} problema(s). Usá los @custom-media de src/breakpoints.css.\n`,
  );
  process.exit(1);
}
console.log("✓ Breakpoints OK — sin drift contra la escala canónica.");

import postcssGlobalData from "@csstools/postcss-global-data";
import postcssCustomMedia from "postcss-custom-media";
import { fileURLToPath } from "node:url";

// Inyecta los @custom-media de src/breakpoints.css en cada CSS Module antes de
// que postcss-custom-media los resuelva, así `@media (--below-desktop)` funciona
// en cualquier *.module.css sin un @import explícito. Path absoluto para que
// resuelva igual en build (vite build) y en tests (vitest procesa los módulos).
const breakpointsFile = fileURLToPath(
  new URL("./src/breakpoints.css", import.meta.url),
);

export default {
  plugins: [
    postcssGlobalData({ files: [breakpointsFile] }),
    postcssCustomMedia(),
  ],
};

---
name: project_auth_redesign
description: Rediseño login/register (split + toggle + showcase SVG) y picker de color de avatar — handoff design_handoff_login
metadata:
  type: project
---

2026-06-01 — Implementado el handoff `handoff/design_handoff_login`.

**Auth unificado.** `pages/auth/Auth.jsx` es un único componente con prop `mode` ("login"|"register"); `Login.jsx`/`Register.jsx` son wrappers delgados que montan `<Auth mode=...>`. El toggle segmentado son dos `<Link>` (to /login y /register) — navega, no swapea in-place, así la URL y `<PublicRoute>` quedan sincronizados. Toda la lógica (banned/flash de sessionStorage, redirect email_not_verified, validación de registro, gating del showcase por `SiteConfig.mesas`) vive en Auth.jsx, branchea por modo.

**Colisión de CSS (importante).** `Auth.module.css` lo comparten 4 archivos más (VerifyEmail/ForgotPassword/ResetPassword/OAuthButtons) que siguen usando las clases **legacy** (`.page`, `.panel`, `.showcase`, `.input`, `.eyebrow`, etc.). El rediseño usa un **namespace propio** (`.stage`, `.formPane`, `.fld`, `.inp`, `.kicker`, `.scImg`, `.previewCard`, …) anexado al final del archivo para no pisarlas. Reusa sólo `.errorBox`/`.successBox` + las clases OAuth. `ShowcaseCard` (la carta legacy con GameTile) se extrajo a `pages/auth/ShowcaseCard.jsx` porque antes se exportaba desde Login.jsx y la usan esas 3 páginas.

**Showcase.** `AuthShowcaseScene.jsx` = ilustración SVG flat-lay (cartas/dados/meeples/hexágonos), superficie "forzada-oscura" (ignora el tema, colores literales, como /utilidades). El form pane sí es theme-aware. Datos reales vía `useShowcaseTables({ refreshMs: 5000 })` (nuevo param opcional que re-fetchea para rotar la mesa; el endpoint `/api/tables/showcase` devuelve una random por llamada). Stats = total mesas + lugares libres de la carta.

**Color de avatar (cuando no hay foto).** Token de marca (`--amber|--red|--green|--orange|--purple`) guardado en `User.avatar.color`. Server: `utils/avatarColors.js#isValidAvatarColor` (allowlist) valida en register (campo opcional) y en `PUT /profile`; el upload/delete de avatar **preservan** el color. Cliente: `<Avatar>` usa `avatar.color` por sobre el hash del _id cuando es válido (`utils/hash.js#isValidAvatarColor`); `getUserDisplay` normaliza `avatar.color`. Componente compartido `components/shared/AvatarColorPicker.jsx` (preview de inicial + swatches + opción "Automático" con `allowAuto` que mapea a ""), usado en el registro y en la sección Avatar de `/perfil`. Medidor de fuerza: `passwordValidation.js#passwordStrength` (0-4) + `STRENGTH_LABELS`.

**OAuth hardening.** `OAuthButtons.jsx` ahora gatea el botón de Google en `import.meta.env.VITE_GOOGLE_CLIENT_ID` (simétrico al de Facebook vía `useFacebookSdk.enabled`): `useGoogleLogin` es un hook y tira al renderizar si falta el clientId, lo que white-screeneaba toda la pantalla de auth. El botón vive en un subcomponente `GoogleButton` que sólo se monta si hay clientId; sin ningún proveedor, la sección no se renderiza. Ver [[project_oauth_login]].

`AuthContext.register(username, email, password, { displayName, avatarColor })` — 4to arg opcional. Ver [[feedback_primary_cta_pattern]] (el submit amber), [[feedback_theme_support]], [[feedback_inline_svg_icons]].

**Update 2026-06-01 (post-merge):** el form de registro **ya NO pide "Nombre para mostrar"** — se removió el campo (con su estado `name`, el icono `User` y su validación); el `autoFocus` pasó al campo de usuario. `register()` se llama solo con `{ avatarColor }` (el `displayName` arg sigue existiendo pero el registro no lo manda). El nombre para mostrar se setea después desde `/perfil`. Tests actualizados (`Auth.test.jsx`/`Register.test.jsx`).

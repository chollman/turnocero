---
name: feedback_brand_name_per_tenant
description: 'En modo tenant (subdominio) el wordmark/títulos/prose muestran el nombre de la comunidad vía useBrandName(); NO hardcodear "TurnoCero" en texto user-facing'
metadata:
  node_type: memory
  type: feedback
  originSessionId: e4c1efe1-758f-434c-91c0-8b40b9b821f2
---

Desde 2026-06-04: el texto user-facing de marca se resuelve con el hook `useBrandName()` ([client/src/hooks/useBrandName.js](client/src/hooks/useBrandName.js)), NO se hardcodea "TurnoCero". En un subdominio de comunidad (modo tenant) eso hace que toda aparición de la marca pase a ser el nombre de la comunidad.

**Why:** una comunidad con subdominio debe verse como su propia marca. Antes "TurnoCero" estaba hardcodeado en ~25 lugares (wordmark, `<title>`, prose).

**Cómo:** `useBrandName()` lee `CommunityContext.brand.name` con `useContext` **null-safe** (cae a "TurnoCero" si no hay provider — así NO rompe tests/montajes sin CommunityProvider). `brand.name` ya resuelve: tenant → nombre de la comunidad; skin de comunidad con brandName en el sitio normal → ese brandName; resto → "TurnoCero".

- Wordmark del chrome: `Navbar` y `SplashScreen` usan brandName (GuestNavbar/GuestSidebar/Auth ya usaban `isTenant ? brand.name : "TurnoCero"`). Navbar además pasa `brand.logoLight/Dark` al `<Logo>`.
- `<title>` de Helmet: interpolar `${brandName}` (Torneos, Compartidas, Noticias, Calendario, Eventos, MathTrade, etc.). Para JSX estático convertir a `<title>{`… ${brandName}`}</title>`.
- Prose de marca: BG Watch (landing/CTAs/PlayDetailModal/HomeWidget), UsersList, UserProfile, share-text de EventoDetail.

**Qué NO se reemplaza (queda "TurnoCero" literal):** referencias a la PLATAFORMA / legales — página **Colabora** (donación a la plataforma), **Términos/Legal**, "política de privacidad de TurnoCero" (Auth). También se dejaron los **OG/twitter meta** del cliente (`og:site_name`, og:title) porque los crawlers los toma el middleware server-side por subdominio; el `alt` default de `<Logo>`; y los fallbacks de nombre (ej. `authorName || "TurnoCero"`).

**Gotcha de verificación (NO es bug del código):** `react-helmet-async` estaba **3.0.0** en node_modules (drift; el lockfile + package.json pinnean `^2.0.5`). El 3.0.0 NO aplica ningún `<title>` bajo React 18 → los títulos quedaban inertes. Fix local: `npm install react-helmet-async@2.0.5` + borrar `node_modules/.vite` + reiniciar dev server (Vite cachea el dep optimizado por hash del lockfile). Un `npm ci` limpio ya da 2.0.5. Ver [[feedback_helmet_version_react18]].

Relacionado: [[project_community_subdomains]], [[feedback_brand_name_turnocero]], [[feedback_nav_section_gating_combined_hook]].

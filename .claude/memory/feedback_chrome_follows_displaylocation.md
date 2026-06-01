---
name: feedback_chrome_follows_displaylocation
description: El chrome del shell (sidebars/navbar/frame) debe derivar de displayLocation de la transición, no del pathname vivo
metadata:
  type: feedback
---

2026-06-01: el chrome del shell (GuestSidebar/GuestNavbar/Sidebar/Navbar + `frameClass`) y el contenido de página deben gatearse con la **misma location**, o se desincronizan durante el slide de `PageTransition`.

**Why:** el contenido se renderiza desde `displayLocation` (que va atrasado ~200ms durante el `slideOut`), pero el chrome se gateaba con `useLocation().pathname` **vivo** (cambia al instante con la URL). Resultado: al ir de `/` a `/login` el sidebar (hijo in-flow de 280px en `.appShell` flex) desaparecía de golpe y `.appContent` reflowaba a ancho completo mientras Compartidas seguía animándose hacia afuera → salto visible.

**How to apply:**
- El estado de la transición vive en el hook `client/src/components/layout/usePageTransition.js` → `{ displayLocation, className, handleAnimationEnd }`. `PageTransition.jsx` es presentacional (recibe `transition` por prop).
- `AppShell` llama al hook una sola vez (antes del early-return de `backendDown`) y lo pasa a `AppRoutes` + lo usa para `frameClass`. `AppRoutes` deriva `isAuthPage = isAuthPath(transition.displayLocation.pathname)`.
- Todo chrome nuevo que dependa de "¿estamos en una auth page / qué sección?" debe usar `transition.displayLocation.pathname`, NO `useLocation()`. El chrome autenticado (`Sidebar`/`Navbar`) también lleva `!isAuthPage` (si no, tras un login exitoso el `Sidebar` aparece antes de que el login termine de salir). `ScrollToTop` es la excepción: usa `useLocation` vivo a propósito (scrollear al cambiar la URL).
- **Gotcha reduced-motion:** el CSS anula el slide con `animation: none` bajo `prefers-reduced-motion: reduce` → `onAnimationEnd` nunca dispara → el swap quedaría colgado en la página vieja. El hook tiene un fast-path: si `matchMedia('(prefers-reduced-motion: reduce)').matches`, swapea `displayLocation` al instante (como same-section).

Tests: `usePageTransition.test.jsx` (lógica del hook + reduced-motion), `PageTransition.test.jsx` (Harness que usa el hook), `AppRoutes.test.jsx` (gating del chrome según `transition.displayLocation`, ambas direcciones).

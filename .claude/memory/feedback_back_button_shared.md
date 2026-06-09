---
name: feedback-back-button-shared
description: "Todo botón \"volver\" usa el componente compartido <BackButton>, no clases ad-hoc"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3d6a6a72-f43b-47b6-a79b-06548cd2b908
---

Desde 2026-06-09 todo botón "volver / atrás" de la web usa el componente compartido [`components/shared/BackButton.jsx`](client/src/components/shared/BackButton.jsx) (+ `.module.css` + test). Antes cada sección tenía su propia clase (`.backBtn` / `.backLink` / `.back`) con tipografías y márgenes distintos; se unificaron todas al patrón del header de detalle de Mesas (TableDetail): JetBrains Mono 11px, MAYÚSCULAS, `letter-spacing 0.1em`, `--text-muted` (hover `--amber-light`), flecha `←` en un `<span aria-hidden>` con `gap: 8px`, `width: fit-content`, `margin: 0 0 20px`.

**API:** `<BackButton to="/ruta">Texto</BackButton>` → renderiza `<Link>`; `<BackButton onClick={fn} disabled={...}>Texto</BackButton>` → `<button type="button">`. El texto va SIN la flecha (la pone el componente). Prop `flush` quita el `margin-bottom` (para back buttons dentro de un contenedor que ya separa: una columna flex con `gap`, o una fila flex con acciones tipo el `.headerRow` de EventoDetail) — sin `flush` el margen se sumaría al `gap` y duplicaría el espacio.

**Why:** el usuario pidió explícitamente "que siempre usen los estilos y márgenes del botón volver de TableDetail" para toda la web.

**How to apply:** para un nuevo back button importá `<BackButton>` y nada de clases CSS propias. Pasá `flush` si el padre es una columna/fila flex con `gap`. NO crees `.backBtn`/`.back`/`.backLink` nuevas.

**Excepciones intencionales (NO se tocaron):** back icon-only del header de chat ([DirectChat](client/src/pages/messages/DirectChat.jsx)), los circulares forzado-oscuro de Utilidades (Dado/Temporizador/FingerSelector), el link ámbar centrado del 404 dedicado de EventoDetail (`.notFoundLink`) + el notFound de EventoInscripciones, el CTA con borde del error box de CompartidaPost (`.backLink`), los switch-links inline de auth ("← Volver al login"), los toggles/pickers de modo ("← Volver a mis juegos/compañeros", "← Elegir otro") y la paginación "← Anterior". Ver catálogo en [[feedback_shared_form_components]].

# Visibilidad de BG Watch — Lista de sugerencias

## Contexto

**BG Watch** es el nombre del set de features de tracking de partidas integradas con BoardGameGeek (BGG). Es una de las funcionalidades más ricas de Turnocero (perfil con partidas, colección, vista por juego, alta/edición/baja de plays, etc.) pero hoy está **prácticamente oculta**:

- **No hay entrada en Sidebar ni BottomNav.** Los items de nav son: Compartite, Noticias, Eventos, Comunidad, Perfil, Utilidades. BG Watch no aparece.
- **Único punto de entrada visible:** un link de texto pequeño dentro de la sección "Contacto" del perfil público de un usuario ([UserProfilePublic.jsx:257-264](../../client/src/pages/users/UserProfilePublic.jsx#L257-L264)) — y solo si ese usuario configuró `bggUsername`.
- **Sin promoción en el propio perfil:** la sección de conexión con BoardGameGeek vive al fondo del form de `/perfil` ([UserProfile.jsx:362-446](../../client/src/pages/users/UserProfile.jsx#L362-L446)). Tras conectarse no hay ningún CTA ni link visible al propio BG Watch.
- **Sin acceso público:** todas las rutas `/perfil-bgg/*` están detrás de `<PrivateRoute>`. Los invitados no pueden navegar perfiles BG Watch aunque sean públicos por definición.
- **Sin presencia en Dashboard, feeds ni listados de comunidad.** El listado `/usuarios` no marca quién tiene BG Watch activo.

El resultado: un usuario que activó BG Watch no tiene un camino claro para volver a su propio perfil, compartirlo, ni descubrir el de otros. Y un usuario que **no** lo activó no tiene cómo descubrir que la feature existe.

Este documento complementa [bgg-perfil-mejoras-roadmap.md](bgg-perfil-mejoras-roadmap.md), que cubre mejoras **de las features internas de BG Watch**. Acá nos enfocamos exclusivamente en **visibilidad y descubribilidad**.

---

## Naming — "BG Watch" vs "BGG"

A partir de ahora, el conjunto de features de tracking de partidas se llama colectivamente **BG Watch**. Reglas:

- **BG Watch** → nombre de **nuestra feature**. Va en todo lo user-facing: items de Sidebar/BottomNav, títulos de páginas, badges, banners, toasts, copy. También en rutas client-side y componentes React.
- **BoardGameGeek** (o **BGG**) → el **servicio externo**. Se usa en texto descriptivo ("Conectá tu cuenta de BoardGameGeek"), en referencias a la API externa, y en data fields que describen la conexión con ese servicio.

Migración concreta (debería hacerse como **paso 0** antes de los items de este plan):

| Antes                                  | Después                                | Notas                                              |
|----------------------------------------|----------------------------------------|----------------------------------------------------|
| Rutas client `/perfil-bgg/...`         | `/bg-watch/...`                        | Redirect 301 desde la ruta vieja por compat        |
| Componentes `BggProfile`, `PerGameView`| `BgWatchProfile`, `BgWatchPerGameView` | Renombrar también `PartidasPanel` etc. si aplica   |
| CSS modules `BggProfile.module.css`    | `BgWatchProfile.module.css`            | Junto con sus clases                                |
| Folder `client/src/pages/bgg/`         | `client/src/pages/bg-watch/`           |                                                    |
| Field `user.bggUsername`               | (se mantiene)                          | Es el username del usuario **en BGG**, no nuestro  |
| Field `user.bggConnected`              | (se mantiene)                          | Indica conexión con el servicio externo            |
| Server route `/api/bgg/...`            | (se mantiene)                          | Es el proxy al XML API de BGG                      |

> **Nota**: los paths de archivos referenciados en este documento usan los nombres actuales (pre-migración). Hay que actualizarlos como parte del rename.

---

## Progreso

Estados: ⬜ Pendiente · 🟡 En progreso · ✅ Implementado

| ID  | Estado | Título                                                 | Esfuerzo    | Prioridad |
|-----|--------|--------------------------------------------------------|-------------|-----------|
| 0   | ✅     | Migración de naming a BG Watch                         | Medio       | 🔥        |
| A.1 | ✅     | Item "BG Watch" en Sidebar                             | Bajo        | 🔥        |
| A.2 | ✅     | Item BG Watch en BottomNav                             | Bajo        | 🔥        |
| A.3 | ✅     | CTA "Activá BG Watch" para no-conectados               | Bajo        |           |
| B.1 | ✅     | Card destacada "Mi BG Watch" en `/perfil`              | Bajo        |           |
| B.2 | ✅     | Toast post-conexión con link al BG Watch               | Bajo        |           |
| B.3 | ✅     | Badge "BG Watch ✓" en header de `/perfil`              | Bajo        |           |
| C.1 | ✅     | Widget "Tu actividad BG Watch" en home                 | Medio       |           |
| C.2 | ⬜     | Widget "Hot list" público (juegos hot de BGG)          | Bajo        |           |
| D.1 | ✅     | Badge 🎲 BG Watch en cards de `/usuarios`              | Bajo        |           |
| D.2 | ⬜     | Filtro "Solo con BG Watch" en `/usuarios`              | Bajo-medio  |           |
| D.3 | ✅     | Card BG Watch prominente en `/usuarios/:id`            | Bajo-medio  |           |
| D.4 | ✅     | Link a BG Watch en TableDetail                         | Bajo        |           |
| D.5 | ⬜     | Link a BG Watch en autores de Compartidas              | Bajo        |           |
| D.6 | ⬜     | "Cargar partida en BG Watch" desde TableDetail         | Medio       |           |
| E.1 | ⬜     | BG Watch público + CTAs de conversión                  | Medio       |           |
| E.2 | ⬜     | OG metadata para `/bg-watch/:username`                 | Medio       |           |
| E.3 | ⬜     | GuestNavbar con link a "Jugadores BG Watch"            | Medio       |           |
| F.1 | ⬜     | Banner one-shot en `/perfil` post-registro             | Bajo        |           |
| F.2 | ⬜     | Empty state contextual con BG Watch de amigos          | Medio       |           |
| F.3 | ⬜     | Featured "Jugador BG Watch de la semana"               | Medio/Alto  |           |
| G.1 | ⬜     | Aviso cuando un amigo carga partida BG Watch con vos   | Alto        |           |
| G.2 | ⬜     | Recordatorio post-mesa para cargar en BG Watch         | Medio       |           |

> Última actualización: 2026-05-17 (A.1 + A.2 + A.3 + B.1 + B.2 + B.3 + C.1 + D.1 + D.3 + D.4 implementados)
> Al implementar un ítem, actualizar tanto el checkbox inline como la fila correspondiente en esta tabla.

---

## Sugerencias

Cada sugerencia incluye: **Esfuerzo** (bajo/medio/alto) y **Impacto** (engagement esperado).

### 0. [x] Migración de naming a BG Watch 🔥
**Qué**: paso previo a todo el resto. Renombrar rutas, componentes, folder de pages y CSS modules según la tabla del bloque "Naming". Agregar redirects 301 de `/perfil-bgg/...` → `/bg-watch/...` para no romper links externos existentes.
**Esfuerzo**: medio. Refactor mecánico pero requiere actualizar todos los `<Link to=...>`, `useNavigate`, imports.
**Impacto**: foundation. Sin esto, los items que mencionan "BG Watch" en UI quedan inconsistentes con el código.

---

### A. Navegación primaria — entrar a BG Watch sin pasar por nadie más

#### A.1 [x] Item "BG Watch" en Sidebar (sólo si `bggUsername` configurado) 🔥
**Qué**: agregar un item con ícono de dado al Sidebar, con label **BG Watch**, que linkea a `/bg-watch/<miBggUsername>`. Solo visible para usuarios con `bggUsername` seteado.
**Por qué**: hoy el camino "Sidebar → Comunidad → buscarme → click en mi BG Watch" es absurdo para llegar al propio perfil.
**Esfuerzo**: bajo. Una entrada condicional en [Sidebar.jsx:196-211](../../client/src/components/layout/Sidebar.jsx#L196-L211).
**Impacto**: alto. Resuelve el problema #1 de descubrimiento.

#### A.2 [x] Item BG Watch en BottomNav (mobile) 🔥
**Qué**: misma idea para [BottomNav.jsx:101-108](../../client/src/components/layout/BottomNav.jsx#L101-L108).
**Esfuerzo**: bajo.
**Impacto**: alto en mobile. Recordar la regla del proyecto: cambios a Sidebar deben sincronizarse con BottomNav.

#### A.3 [x] Si no está conectado → CTA "Activá BG Watch" en su lugar
**Qué**: para usuarios sin `bggUsername` seteado, el slot puede mostrar el CTA "Activá BG Watch" en una sección secundaria del Sidebar ("Más", "Explorar") para no canibalizar nav primario, o aparecer como sugerencia en Dashboard (ver C.1) en lugar de en nav.
**Esfuerzo**: bajo.
**Impacto**: medio. Resuelve el problema #2 (descubrir que existe).

**Implementación (2026-05-17)**: se eligió un enfoque combinado más fuerte que el original.
- Nueva ruta pública `/bg-watch` (sin username) con una landing explicativa (`BgWatchLanding.jsx`) que muestra qué es BG Watch, 3 features destacadas, un CTA adaptativo (registro / login según estado) y "cómo funciona" en 3 pasos. Si un usuario logueado con `bggUsername` entra, redirige a `/bg-watch/<username>`.
- Sidebar: en el slot del BG Watch normal, para usuarios sin `bggUsername` se muestra item promo "Activá BG Watch" con estilo distintivo (background amber tenue, tag "Nuevo") que linkea a la landing.
- BottomNav: mismo patrón, item promo "Activá" con punto amber.
- `/usuarios`: banner arriba de la lista promocionando BG Watch (visible solo para autenticados sin `bggUsername`).
- `ScrollToTop` actualizado para respetar hash anchors (necesario para que `/perfil#conexion-bgg` haga scroll a la sección BGG).
- Sección "Conexión con BoardGameGeek" en `/perfil` recibió `id="conexion-bgg"` para el deep-link.

---

### B. Promoción en `/perfil` propio — premio post-conexión

#### B.1 [x] Card destacada "Mi BG Watch" en `/perfil`
**Qué**: tras conectar la cuenta de BoardGameGeek, mostrar arriba del form (no enterrado al fondo) una card visual con: avatar, username de BGG, cantidad de partidas y juegos, y un CTA "Ver mi BG Watch completo →".
**Esfuerzo**: bajo. Reordenar [UserProfile.jsx](../../client/src/pages/users/UserProfile.jsx) y agregar fetch ligero de stats.
**Impacto**: alto. El usuario que ya pagó el costo de conectar tiene su recompensa visible.

**Implementación (2026-05-17)**:
- Nuevo componente `client/src/pages/users/MiBgWatchCard.jsx` + `.module.css`. Card clickeable (toda ella es un `<Link>` a `/bg-watch/<username>`) con avatar amber + badge dado, identidad (eyebrow "◆ MI BG WATCH", `@username`, tag "Conectado a BoardGameGeek" con dot verde), CTA inline "Ver mi BG Watch completo →" con flecha animada en hover, y row de stats (Partidas, Juegos en colección, Última partida).
- Fetch en paralelo de `/api/bgg/partidas/:username?page=1` (total + última fecha) y `/api/bgg/coleccion/:username` (length = juegos únicos). Maneja errores silenciosamente con nota suave ("igual podés entrar a tu BG Watch").
- Integrada en [UserProfile.jsx](../../client/src/pages/users/UserProfile.jsx) entre el hero y el `formCard`. Solo se renderiza si `user.bggUsername && user.bggConnected && !user.bggInvalid` (es decir, conexión activa y válida).
- Endpoints reutilizan caché server-side (5–30 min) → carga rápida en revisitas.

#### B.2 [x] Toast / pantalla de bienvenida tras conectar
**Qué**: justo después de un `POST /api/auth/bgg-connect` exitoso, además del toast actual de éxito, ofrecer un botón explícito "Ir a mi BG Watch ahora" que navega a `/bg-watch/<username>`.
**Esfuerzo**: bajo. Cambio puntual en el handler de connect.
**Impacto**: medio.

**Implementación (2026-05-17)**:
- Nuevo tipo de toast `bgwatch_connected` registrado en [ToastContainer.jsx](../../client/src/components/layout/ToastContainer.jsx): icono 🎲, título "¡Conectado a BG Watch!", body "Tocá para ir a tu BG Watch ahora →", duración 7000ms (más largo que el default para dar tiempo a clickear).
- Click handler navega a `/bg-watch/<bggUsername>`. Como todo el toast es clickeable (siguiendo el patrón del resto del sistema), no hace falta un botón separado — el toast entero ES el CTA.
- En [UserProfile.handleBggConnect](../../client/src/pages/users/UserProfile.jsx) se dispara `addToast({ type: 'bgwatch_connected', bggUsername })` justo después del `refreshUser()` exitoso. Sigue el mismo patrón cliente-side que `tournament_pending` en RegisterButton.

> Nota: el plan menciona "además del toast actual de éxito", pero en realidad no había feedback explícito post-conexión más allá del cambio visual de la UI (la sección pasa a mostrar "Conectado como @username"). Este toast es el primer feedback ephemeral del flujo.

#### B.3 [x] Badge "BG Watch ✓" en el header del propio perfil
**Qué**: un chip pequeño al lado del nombre en `/perfil` indicando "BG Watch activo" como link clickeable al propio perfil.
**Esfuerzo**: bajo.
**Impacto**: bajo, pero refuerza la presencia del feature.

**Implementación (2026-05-17)**: en [UserProfile.jsx](../../client/src/pages/users/UserProfile.jsx) se envolvió el `<h1>` del hero en un `.titleRow` flex que permite alinear el badge inline. Badge es un `<Link>` con pill amber tenue (dado SVG + texto "BG Watch" + check ✓ circular), visible solo si `bggUsername && bggConnected && !bggInvalid`. Linkea a `/bg-watch/<bggUsername>`. Hover: fondo amber más fuerte + lift de 1px.

---

### C. Dashboard / landing — widget BG Watch

#### C.1 [x] Widget "Tu actividad BG Watch" en home
**Qué**: para usuarios con BG Watch activo, un widget que muestre: últimas 3 partidas, win rate del mes, link "Ver todo →". Para usuarios sin BG Watch: un widget promocional "¿Tenés cuenta en BoardGameGeek? Activá BG Watch para registrar tus partidas →".
**Dónde**: depende del home actual. Hoy `/` es Dashboard solo para admins; los usuarios regulares ven `/compartidas` o equivalente. Habría que decidir el surface (¿`/mi`? ¿una nueva home?).
**Esfuerzo**: medio.
**Impacto**: alto en retención de usuarios conectados.

**Implementación (2026-05-17)**:
- Surface elegido: **`CompartidasSidebar`** (columna derecha en desktop, hidden en mobile por el patrón del sidebar). Iteración: inicialmente se puso al tope del `feedCol`, pero ocupaba demasiado espacio sobre el feed; se movió al sidebar.
- Nuevo componente `client/src/pages/compartidas/BgWatchHomeWidget.jsx` + `.module.css` con dos variantes que reutilizan el lenguaje visual de los otros widgets del sidebar (mismo `.widget` shell, eyebrows + title + link "Ver todo"):
  - **`ConnectedView`** (BG Watch activo): header con eyebrow "◆ TU BG WATCH" + link "Ver todo →"; título "Últimas partidas"; lista vertical de 3 rows compactos (thumb 38×38 + nombre + fecha relativa "Hoy"/"Ayer"/"Hace N d"/"12 may" + chip verde "W" si el user ganó). Click en row → `/bg-watch/<u>/juego/<gameId>`. Maneja loading (skeleton shimmer), empty ("Sin partidas registradas todavía") y error.
  - **`PromoView`** (no conectado): widget con título "¿Llevás tus partidas en BGG?", sub explicativo y CTA "Activá BG Watch →". Card entera es un `<Link>` a `/bg-watch`.
- Decisión sobre win rate del mes: se descartó para mantener el widget liviano (un solo fetch a `/api/bgg/partidas/:u?page=1`, cacheado server-side). Las últimas 3 partidas + chip "W" transmiten estado reciente sin un fetch adicional con filtro de fecha.
- Integrado en [CompartidasSidebar.jsx](../../client/src/pages/compartidas/CompartidasSidebar.jsx) como primer widget de la columna lateral (visible solo ≥960px).
- En mobile (<960px), el mismo componente se renderiza inline en [Compartidas.jsx](../../client/src/pages/compartidas/Compartidas.jsx) justo después del `pageHeader` (antes del create form), wrapped en `.mobileWidgetSlot` que es `display:none` en desktop. Se duplica el render (sidebar + inline) pero solo uno es visible por viewport; los fetches duplicados son triviales por el caché server-side.
- **Dismiss en la variante promo (mobile + desktop)**: ambos renders (inline mobile + sidebar desktop) pasan `dismissible` y la variante `PromoView` muestra un botón ✕ en la esquina superior derecha. Click → persiste en `localStorage` (`turnocero_bgwatch_promo_dismissed`) y oculta el widget en futuras visitas. Como la key es compartida, dismissar en cualquiera de los dos breakpoints lo oculta en ambos. La variante conectada nunca es dismissible. La preferencia es por-dispositivo (no se sincroniza al server).

#### C.2 [ ] Widget "Hot list" público (juegos hot en BGG)
**Qué**: ya está en el roadmap existente ([sección 4.1](bgg-perfil-mejoras-roadmap.md)). Reforzar como surface de descubrimiento: aparece para invitados también, generando incentivo a conectar.
**Esfuerzo**: bajo.
**Impacto**: medio.

---

### D. Cross-promoción entre features existentes

#### D.1 [x] Badge "🎲 BG Watch" en cards de usuario en `/usuarios`
**Qué**: en la grilla/lista de Comunidad ([UsersList](../../client/src/pages/users/UsersList.jsx)), un chip discreto en las cards de usuarios que tienen `bggUsername`, clickeable directo a su BG Watch.
**Esfuerzo**: bajo. El listado ya trae el campo.
**Impacto**: alto para descubrimiento social — convierte cada user card en un punto de entrada a BG Watch.

**Implementación (2026-05-17)**: en [UsersList.jsx](../../client/src/pages/users/UsersList.jsx), dentro de `cardMeta` (junto a los chips de ubicación y "Desde"), se agregó un `<Link>` con clase `.bgWatchChip`: pill amber tenue con dado SVG (12×12) + texto "BG Watch" en uppercase. Visible solo si `user.bggUsername`. `onClick` con `stopPropagation` para que no dispare el click del card (que navega a `/usuarios/:id`). Hover: fondo amber más fuerte + lift 1px. `title` accesible: "Ver el BG Watch de @username".

> **Cambio backend**: el listado `GET /api/users` (en [server/routes/users.js](../../server/routes/users.js)) no incluía `bggUsername` en el `select` (sí lo hacía el detalle `/:id` que comparte campos similares, lo cual generó confusión inicial). Se agregó `bggUsername` a ambas variantes de `selectFields` (admin y no-admin) para que el chip pueda condicionarse a su presencia.

#### D.2 [ ] Filtro "Solo con BG Watch" en `/usuarios`
**Qué**: tab/toggle que filtre el listado a usuarios con BG Watch activo. Útil para encontrar contrincantes con tracking de partidas.
**Esfuerzo**: bajo-medio. Requiere param backend.
**Impacto**: medio.

#### D.3 [x] Card BG Watch prominente en `/usuarios/:id`
**Qué**: hoy es un text-link enterrado en "Contacto". Subirlo a una card propia tipo "Stats BG Watch" con thumbnail del juego más jugado + botón "Ver BG Watch".
**Esfuerzo**: bajo-medio.
**Impacto**: alto.

**Implementación (2026-05-17)**:
- Nuevo componente [BgWatchUserCard.jsx](../../client/src/pages/users/BgWatchUserCard.jsx) + `.module.css`. Comparte el lenguaje visual de [MiBgWatchCard](../../client/src/pages/users/MiBgWatchCard.jsx) (gradient amber, avatar con badge de dado, eyebrow `◆ BG WATCH`, CTA inline "Ver BG Watch →" con arrow animada) pero agrega una row destacada **"Juego más jugado"** con thumbnail (56×56, cae a placeholder con dado si BGG no devuelve uno), nombre del juego y conteo de partidas. Toda la card es un `<Link>` a `/bg-watch/<bggUsername>`.
- Fetch en paralelo de `/api/bgg/partidas/:u?page=1` (total + última fecha) y `/api/bgg/coleccion/:u` (length = juegos únicos + ranking por `numPlays` desc para derivar el top game). Skeleton shimmer en la row del juego durante loading. Error silencioso con nota suave si ambos endpoints fallan.
- Integrada en [UserProfilePublic.jsx](../../client/src/pages/users/UserProfilePublic.jsx) entre la `statsGrid` y el `layout` two-column. Renderiza solo si `profile.bggUsername` está seteado.
- Limpieza: removida la fila `🎲 BG Watch` de la card "Contacto" y el chip `🎲 BG Watch` de los `contactParts` del hero (quedaban redundantes). El import de `Link` ya no era necesario.

#### D.4 [x] Link a BG Watch en TableDetail (de hosts/players con BG Watch)
**Qué**: en la lista de jugadores de una mesa, ícono de dado al lado del nombre que linkea a su `/bg-watch/...`. Hover muestra "Ver historial de partidas".
**Esfuerzo**: bajo.
**Impacto**: medio. Conecta el flujo "estoy por jugar con X" con "¿qué jugó X últimamente?".

**Implementación (2026-05-17)**:
- **Backend**: en [server/routes/tables.js](../../server/routes/tables.js), se extrajo `POPULATE_USER_FIELDS = 'username bggUsername'` como constante y se aplicó en `populateTable` (host + players + pendingRequests) y en todos los `.populate('host', ...)` individuales (create, leave, join flows, showcase). Así el endpoint expone `bggUsername` consistentemente para cualquier user populated.
- **Frontend**: en [TableDetail.jsx](../../client/src/pages/tables/TableDetail.jsx), nuevo componente helper `PlayerBgWatchLink` que renderiza un mini icono-link (dado 12×12 en un cuadrado 20×20 con bg amber tenue) cuando el user tiene `bggUsername`. Se inserta en el host chip y en cada player chip de la sección "EN LA MESA", entre el nombre y el tag (Host/vos). No se renderiza si el user está eliminado (matcheando el patrón del avatar fantasma). `title` = "Ver historial de partidas de @username", `aria-label` accesible, `onClick` con `stopPropagation` por consistencia (los chips actualmente no son clickeables pero por si en el futuro lo son).
- **Estilos**: `.playerChipBgWatch` en [TableDetail.module.css](../../client/src/pages/tables/TableDetail.module.css), pill cuadrado amber tenue con hover más intenso + lift 1px.

#### D.5 [ ] Link a BG Watch en autores de Compartidas
**Qué**: en `CompartidaCard` y `CompartidaPost`, si el autor tiene `bggUsername`, agregar el ícono/link a su BG Watch.
**Esfuerzo**: bajo.
**Impacto**: bajo-medio.

#### D.6 [ ] Mostrar "Cargar partida en BG Watch" en TableDetail tras jugar
**Qué**: ya listado en roadmap (sección 2.1) pero también es una **palanca de visibilidad**: el CTA aparece en una pantalla que muchos visitan, generando familiaridad con la feature.
**Esfuerzo**: medio.
**Impacto**: alto si se ejecuta junto con A.1.

---

### E. Acceso público — abrir BG Watch a invitados (con CTAs de conversión)

> **Filosofía**: cada perfil BG Watch público funciona como una landing page que vende el valor del tracking de partidas a usuarios anónimos. La apertura va **siempre acompañada de CTAs de registro** para que la viralidad alimente conversión, no la canibalice.

#### E.1 [ ] BG Watch público (sin auth) + estrategia de conversión
**Qué**: cambiar la ruta `/bg-watch/:bggUsername` de `<PrivateRoute>` a abierta (read-only). Acciones de escritura ("Nueva partida", editar, borrar) ocultas si no hay sesión o si la sesión no matchea al dueño.

**CTAs de registro obligatorios para invitados** (no es opcional, es parte del diseño):
- **Banner sticky superior**: "Llevá tus partidas como [Ana] con BG Watch. Registrate gratis →" — visible siempre mientras se navega como guest.
- **CTA inline tras las stats hero**: "¿Tenés cuenta en BoardGameGeek? Activá BG Watch en Turnocero" con botón directo a `/register`.
- **Soft paywall en interacciones**: clickear "Like en una partida", "Comentar", o intentar abrir `CreatePlayModal` → modal `LoginPromptModal` (ya existe en el proyecto, [client/src/components/shared/LoginPromptModal](../../client/src/components/shared/LoginPromptModal)) con copy contextual.
- **Footer del perfil**: "Este es el BG Watch de [Ana], una jugadora de Turnocero. Vos también podés tener el tuyo → Registrate".

**Esfuerzo**: medio. Tocar [App.jsx:115-116](../../client/src/App.jsx#L115-L116), agregar guards en `BgWatchProfile.jsx` y `BgWatchPerGameView.jsx`, y crear el componente de CTAs sticky.
**Impacto**: alto.
- Permite compartir links de BG Watch por afuera del app (WhatsApp, redes).
- Es coherente con que Compartidas también es público.
- Convierte cada perfil en una herramienta de marketing — el dueño hace promoción del app cuando comparte su link.

**Validación**: tracking de conversión específico para landings BG Watch (UTM o flag `source=bg-watch` en el formulario de register) para medir si efectivamente convierten más que el muro duro actual.

#### E.2 [ ] OG metadata para `/bg-watch/:username`
**Qué**: análogo al existente para Compartidas (`GET /api/compartidas/:id/og`). Endpoint `GET /api/bg-watch/og/:username` que devuelve título + thumbnail del juego más jugado, para previews ricos en WhatsApp.
**Esfuerzo**: medio. Requiere extender [middleware.js](../../client/middleware.js).
**Impacto**: medio-alto si se viraliza el compartido de perfiles.

#### E.3 [ ] GuestNavbar con link a "Jugadores BG Watch"
**Qué**: solo aplica si E.1 se implementa. Agregar un link en [GuestNavbar.jsx](../../client/src/components/layout/GuestNavbar.jsx) que lleve a una lista pública de perfiles BG Watch destacados.
**Esfuerzo**: medio.
**Impacto**: medio.

---

### F. Onboarding — captar usuarios sin BG Watch activo

#### F.1 [ ] Banner one-shot en `/perfil` post-registro
**Qué**: para nuevos usuarios, banner dismissible "¿Llevás cuenta en BoardGameGeek? Activá BG Watch para registrar todas tus partidas".
**Esfuerzo**: bajo. Usar localStorage para dismissal.
**Impacto**: alto en conversión.

#### F.2 [ ] Empty state contextual cuando un amigo loguea una mesa
**Qué**: si un amigo del usuario tiene BG Watch activo y carga partidas, mostrarle al usuario sin BG Watch un nudge: "Ana usa BG Watch para registrar sus partidas. ¿Querés hacer lo mismo?".
**Esfuerzo**: medio. Requiere lógica condicional + tracking de amigos con BG Watch.
**Impacto**: medio.

#### F.3 [ ] Featured "Jugador BG Watch de la semana"
**Qué**: en `/compartidas` o Noticias, destacar un perfil BG Watch por semana (manual o automatizado por # partidas en últimos 7 días). Click → ese perfil.
**Esfuerzo**: medio (manual) / alto (automatizado).
**Impacto**: medio.

---

### G. Notificaciones y feedback ambiental

#### G.1 [ ] Aviso cuando un amigo carga una partida con vos
**Qué**: si alguien carga una partida BG Watch donde aparezco como jugador (matcheando por `bggUsername`), notificación "Ana cargó una partida de Wingspan con vos en BG Watch".
**Esfuerzo**: alto. Requiere matching server-side de jugadores BGG → usuarios Turnocero (depende del 2.3 del roadmap existente, "Linkear jugadores BGG → usuarios").
**Impacto**: alto si funciona — bucle de engagement social fuerte.

#### G.2 [ ] Recordatorio post-mesa
**Qué**: 24h después de una mesa marcada como jugada, push/notif "¿Cargás esa partida en BG Watch?".
**Esfuerzo**: medio (job programado).
**Impacto**: medio.

---

## Priorización sugerida

Si elegir 4-5 quick wins de **máximo impacto / mínimo esfuerzo** (precedidos siempre del paso 0):

0. **Migración a BG Watch** — sin esto el resto queda inconsistente.
1. **A.1 + A.2** — item BG Watch en Sidebar y BottomNav (condicional a `bggUsername`). El cambio más obvio y de mayor retorno.
2. **D.1** — badge BG Watch en `/usuarios`. Convierte Comunidad en surface de descubrimiento.
3. **B.1** — card "Mi BG Watch" en `/perfil`. Recompensa al usuario conectado.
4. **E.1** — abrir `/bg-watch/:username` a invitados. Habilita viralidad por fuera del app.
5. **F.1** — banner one-shot post-registro para usuarios sin BG Watch. Mueve la aguja de conversión.

Estos cinco juntos resuelven los problemas estructurales sin pedir features nuevas y son todos esfuerzo bajo o medio.

---

## Archivos críticos a tocar (referencia)

- [client/src/components/layout/Sidebar.jsx](../../client/src/components/layout/Sidebar.jsx) — A.1
- [client/src/components/layout/BottomNav.jsx](../../client/src/components/layout/BottomNav.jsx) — A.2
- [client/src/components/layout/GuestNavbar.jsx](../../client/src/components/layout/GuestNavbar.jsx) — E.3
- [client/src/pages/users/UserProfile.jsx](../../client/src/pages/users/UserProfile.jsx) — B.1, B.2, B.3, F.1
- [client/src/pages/users/UserProfilePublic.jsx](../../client/src/pages/users/UserProfilePublic.jsx) — D.3
- [client/src/pages/users/UsersList.jsx](../../client/src/pages/users/UsersList.jsx) — D.1, D.2
- [client/src/pages/tables/TableDetail.jsx](../../client/src/pages/tables/TableDetail.jsx) — D.4, D.6
- [client/src/pages/compartidas/CompartidaCard.jsx](../../client/src/pages/compartidas/CompartidaCard.jsx) — D.5
- [client/src/App.jsx](../../client/src/App.jsx) — E.1 (mover rutas a abierto)
- [client/middleware.js](../../client/middleware.js) — E.2
- [client/src/pages/bgg/](../../client/src/pages/bgg/) — paso 0 (rename a `bg-watch/`)

## Verificación

Esto es un documento de sugerencias, no de implementación. La validación es conversacional: revisar la lista con el dueño del producto, elegir un subconjunto, y de ahí derivar planes de implementación específicos por sugerencia priorizada.

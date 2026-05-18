# Roadmap — Mejoras al BG Watch

Este archivo es el complemento de [mejorar-perfil-bgg.md](../mejorar-perfil-bgg.md). Las ideas listadas acá quedaron **fuera del scope ejecutable** de esa iteración pero son las direcciones más prometedoras detectadas durante el análisis de la API de BGG y los patrones de uso del app.

Cada item incluye:
- **Qué**: descripción breve
- **Datos disponibles**: qué endpoint/campo de BGG lo habilita
- **Esfuerzo**: bajo / medio / alto

Las prioridades sugeridas están ordenadas por impacto percibido / esfuerzo. Las primeras 5-6 son "quick wins" que sumarían bastante valor sin tocar mucho código.

---

## Naming — "BG Watch" vs "BGG"

**BG Watch** es el nombre user-facing del set de features de tracking de partidas. **BGG** / **BoardGameGeek** se reserva para el servicio externo y para campos de modelo que lo describen. Ver el bloque "Naming" de [bgg-visibilidad-sugerencias.md](bgg-visibilidad-sugerencias.md) para la tabla de migración (rutas, componentes, folder).

En este documento, los nombres de componentes mencionados (`BgWatchProfile`, `BgWatchPerGameView`, etc.) asumen post-migración. Sub-componentes internos (`PartidasPanel`, `PlayCard`, `CreatePlayModal`, etc.) conservan sus nombres genéricos porque viven dentro del scope del folder `client/src/pages/bg-watch/`.

---

## Progreso

Estados: ⬜ Pendiente · 🟡 En progreso · ✅ Implementado

| ID  | Estado | Título                                                      | Esfuerzo    | Prioridad |
|-----|--------|-------------------------------------------------------------|-------------|-----------|
| 1.1 | ⬜     | Heatmap calendario de actividad (estilo GitHub)             | Medio       | 🔥        |
| 1.2 | ⬜     | Head-to-head record contra cada oponente                    | Medio       | 🔥        |
| 1.3 | ⬜     | Win rate global y por período                               | Bajo/Medio  |           |
| 1.4 | ⬜     | Duración media y total acumulado por juego                  | Medio       |           |
| 1.5 | ⬜     | Streaks de victorias / derrotas                             | Medio       |           |
| 1.6 | ⬜     | Análisis de patrones temporales                             | Bajo        |           |
| 1.7 | ⬜     | Variety score                                               | Bajo        |           |
| 1.8 | ⬜     | Rating consistency (scatter plot)                           | Medio       |           |
| 2.1 | ⬜     | Cross-reference con Mesas                                   | Medio       | 🔥        |
| 2.2 | ⬜     | Crear Compartida desde un PlayCard                          | Bajo-medio  |           |
| 2.3 | ✅     | Linkear jugadores BGG → usuarios de Turnocero               | Medio       | 🔥        |
| 2.4 | ⬜     | Comparación con amigos                                      | Medio       |           |
| 2.5 | ⬜     | Timeline unificado (memorias)                               | Alto        |           |
| 3.1 | ⬜     | Autocomplete de amigos en CreatePlayModal                   | Bajo-medio  | 🔥        |
| 3.2 | ⬜     | Sugerir ubicaciones recientes                               | Bajo        |           |
| 3.3 | ⬜     | Sugerir juegos recientes en step 1                          | Bajo        |           |
| 3.4 | ⬜     | Rating del jugador (slider 1-10) en step 3                  | Bajo        |           |
| 3.5 | ⬜     | Position drag-to-reorder en step 3                          | Medio       |           |
| 3.6 | ⬜     | Color picker con paleta                                     | Bajo        |           |
| 3.7 | ⬜     | Validación: ganador único                                   | Bajo        |           |
| 4.1 | ⬜     | Hot list de BGG                                             | Bajo        |           |
| 4.2 | ⬜     | Recomendaciones basadas en mecánicas                        | Alto        |           |
| 4.3 | ⬜     | Detección de duplicados                                     | Bajo        |           |
| 5.1 | ⬜     | Skeleton loaders en PartidasPanel y BgWatchPerGameView      | Bajo        |           |
| 5.2 | ⬜     | Optimistic update en delete y edit                          | Bajo        |           |
| 5.3 | ⬜     | Confirmación visual post-carga                              | Bajo        |           |
| 5.4 | ⬜     | Drafts / borrador de partida                                | Bajo-medio  |           |
| 5.5 | ⬜     | Bulk delete                                                 | Medio       |           |
| 5.6 | ⬜     | Filtros server-side por jugador                             | Medio       |           |
| 5.7 | ⬜     | Export a CSV                                                | Bajo        |           |

> Última actualización: 2026-05-17 (2.3 implementado)
> Al implementar un ítem, actualizar tanto el checkbox inline como la fila correspondiente en esta tabla.

---

## 1. Estadísticas avanzadas

### 1.1 [ ] Heatmap calendario de actividad (estilo GitHub) 🔥
**Qué**: grilla anual con un cuadrado por día, color amber tinted según cantidad de partidas. Permite detectar patrones (siempre jugás los viernes, te tomaste 3 meses de pausa, etc.).
**Datos**: `play.date` de todas las partidas del usuario.
**Esfuerzo**: medio. Requiere cargar todas las páginas de partidas o, mejor, un endpoint server-side que agrupe por fecha (con cache largo, ya que el pasado no cambia).
**Dónde**: en `BgWatchPerGameView` (heatmap por juego) o en una pestaña nueva "Stats" del `BgWatchProfile`.

### 1.2 [ ] Head-to-head record contra cada oponente 🔥
**Qué**: "Tu récord contra Ana: 7 victorias, 3 derrotas, 1 empate". Top 10 oponentes más frecuentes.
**Datos**: `play.players[]` con `player.name` + `player.win`.
**Esfuerzo**: medio. Cargar todas las partidas, agrupar por (oponente, win). Cache server-side por usuario.
**Dónde**: nueva sección "Oponentes" en el `BgWatchProfile`.

### 1.3 [ ] Win rate global y por período
**Qué**: % de victorias en total, en este año, en los últimos 30 días. Comparación con períodos anteriores.
**Datos**: `play.players[]` matcheando el owner por `username`.
**Esfuerzo**: bajo si solo se calcula sobre la página actual; medio si querés exactitud cargando todo.

### 1.4 [ ] Duración media y total acumulado por juego
**Qué**: "Has jugado 47 horas a Wingspan en 22 partidas". Cards de top 10 juegos por horas totales.
**Datos**: `play.duration` + `play.gameId` agregados.
**Esfuerzo**: medio.
**Dónde**: enriquecer la vista "Por juego" del `PartidasPanel`.

### 1.5 [ ] Streaks de victorias / derrotas
**Qué**: "Llevás 5 victorias seguidas en Catán" o "Cortó tu racha de 8 derrotas en Wingspan".
**Datos**: secuencia ordenada de plays por juego con `win` flag.
**Esfuerzo**: medio.
**Dónde**: badge inline en `BgWatchPerGameView` cuando aplica.

### 1.6 [ ] Análisis de patrones temporales
**Qué**: gráfico de barras "Día de la semana en que más jugás" y "Hora típica" (si BGG diera hora — no la da, pero podría inferirse del orden).
**Datos**: `play.date` (BGG no expone hora).
**Esfuerzo**: bajo si solo es por día de semana.

### 1.7 [ ] Variety score
**Qué**: cuántos juegos distintos jugaste en las últimas N partidas. Indicador de si jugás siempre lo mismo o explorás.
**Datos**: `gameId` único en últimas N partidas.
**Esfuerzo**: bajo.

### 1.8 [ ] Rating consistency
**Qué**: scatter plot "Tu rating del juego (post-partida) vs el rating promedio de BGG". Indica si sos generoso o severo comparado con la comunidad.
**Datos**: `player.rating` por partida + `bggRating` del juego (de la colección).
**Esfuerzo**: medio. Requiere librería de charts (chart.js, recharts).

---

## 2. Integración con el resto de Turnocero

### 2.1 [ ] Cross-reference con Mesas 🔥
**Qué**: cuando se cierra una mesa (estado `cancelled` o cuando todos los players marquen que la jugaron), ofrecer un CTA "¿Cargar en BG Watch?" que abre el `CreatePlayModal` con datos pre-llenados (juego, fecha, jugadores Turnocero linkeados como BGG si tienen `bggUsername`).
**Datos**: Mesa.players → User.bggUsername.
**Esfuerzo**: medio. Necesita un trigger en el flujo de "marcar mesa jugada" (que actualmente no existe).
**Dónde**: `TableDetail.jsx`.

### 2.2 [ ] Crear Compartida desde un PlayCard
**Qué**: botón "Compartir esta partida" en el menu kebab → preselecciona el linkedTable (si match) o abre el form de compartida con el nombre del juego + fecha + jugadores.
**Datos**: `play.gameName`, `play.players`, `play.date`, `play.comments`.
**Esfuerzo**: bajo-medio. Hay que pasar datos al `CreateCompartidaForm`.

### 2.3 [x] Linkear jugadores BGG → usuarios de Turnocero 🔥
**Qué**: cuando renderiza chips de jugadores en `PlayCard` / `PlayDetailModal`, si el `player.username` (que es el username de BGG del jugador) matchea con un User de Turnocero (case-insensitive `bggUsername`), mostrar avatar + nombre + link a `/usuarios/:id`.
**Datos**: nuevo endpoint `POST /api/users/by-bgg-usernames` que recibe array de usernames y devuelve usuarios matcheados.
**Esfuerzo**: medio. Hay que batchear el lookup para no hacer N requests por página.

**Implementación (2026-05-17)**:
- **Backend**: `POST /api/users/by-bgg-usernames` en [server/routes/users.js](../../server/routes/users.js). Público (sin auth — necesario porque las páginas de BG Watch son públicas también). Recibe `{ usernames: [...] }`, dedupea + lowercases + limita a 50 entradas por request. Usa aggregation con `$toLower` para hacer match case-insensitive sin agregar índice nuevo al field `bggUsername`. Excluye usuarios baneados. Retorna `[{ _id, username, displayName, avatar, bggUsername }]`.
- **Hook reusable** [useBggUserMap.js](../../client/src/pages/bg-watch/useBggUserMap.js): toma una lista de plays, extrae los unique `player.username` (lowercased), y hace POST al endpoint. Devuelve un objeto map `{ bggUsernameLower → turnoceroUser }`. Memoiza la key del set para no re-fetchear cuando el render se repite con la misma lista. Maneja cancellation con un flag local. Falla silenciosamente (vuelve `{}`) para que la UI siga funcionando sin links.
- **Wiring**:
  - [PartidasPanel.jsx](../../client/src/pages/bg-watch/PartidasPanel.jsx): llama el hook con `plays?.plays` y pasa `userMap` a cada `PlayCard`.
  - [BgWatchPerGameView.jsx](../../client/src/pages/bg-watch/BgWatchPerGameView.jsx): mismo patrón. Acá el `userMap` se comparte con `PlayDetailModal` porque las partidas vienen de la misma fuente.
  - [BgWatchProfile.jsx](../../client/src/pages/bg-watch/BgWatchProfile.jsx): el `openPlay` vive en este componente pero los plays viven adentro de `PartidasPanel`, así que se hace una segunda llamada al hook con solo `[openPlay]` cuando hay modal abierto. Es ~10 usernames como mucho, costo trivial. La alternativa (lift state) sumaba coupling sin beneficio.
- **UI updates**:
  - `PlayerChip` en [PlayCard.jsx](../../client/src/pages/bg-watch/PlayCard.jsx): cuando hay match, se renderiza como `<Link to="/usuarios/:id">` con avatar (img o fallback con inicial) + displayName + score + winIcon. `stopPropagation` en el click para no disparar el modal del PlayCard. Cuando no hay match, queda el `<span>` original.
  - `PlayDetailModal` player row: el avatar (22×22) + displayName aparecen en `playerCellName`. El @username debajo cambia de link externo a BGG a `<Link>` interno a `/usuarios/:id` con copy "@username · en Turnocero". Cuando no hay match, mantiene el link externo a BGG como antes.
- **Estilos nuevos en [BgWatchProfile.module.css](../../client/src/pages/bg-watch/BgWatchProfile.module.css)**:
  - `.playerChipLinked` (hover amber + lift, `text-decoration: none`)
  - `.playerChipAvatar` + `.playerChipAvatarFallback` (16×16 redondo)
  - `.playerCellAvatar` + `.playerCellAvatarFallback` (22×22 redondo para tabla del modal)
- **Edge cases manejados**: si `userMap` es undefined o el lookup falla → caen al render original (BGG name + BGG link), nada se rompe. Usuario sin `avatar` → muestra fallback con la inicial del display name. Player sin `username` → no se busca en el map (no se rompe).

### 2.4 [ ] Comparación con amigos
**Qué**: "¿Quién jugó más Wingspan entre tus amigos?" — leaderboard del juego solo con amigos que tienen `bggUsername` configurado.
**Datos**: `User.friends` + `numPlays` de la colección de cada amigo.
**Esfuerzo**: medio. Requiere multiplexar requests a `/api/bgg/coleccion/:user` por cada amigo.
**Dónde**: `BgWatchPerGameView`.

### 2.5 [ ] Timeline unificado (memorias)
**Qué**: feed mixto en `/mi` que combina Mesas, Compartidas y partidas de BG Watch en una sola línea de tiempo ordenada por fecha.
**Datos**: triple fuente.
**Esfuerzo**: alto. Cambio de arquitectura significativo.

---

## 3. Mejoras al flujo de carga

### 3.1 [ ] Autocomplete de amigos en CreatePlayModal 🔥
**Qué**: en step 3 (Jugadores), en lugar de solo texto libre, ofrecer un autocomplete con los `friends` del usuario que tienen `bggUsername` configurado. Click → autollena name + username.
**Datos**: `User.friends` filtrados por `bggUsername !== ''`.
**Esfuerzo**: bajo-medio. Necesita un endpoint `GET /api/users/me/friends?withBgg=1`.

### 3.2 [ ] Sugerir ubicaciones recientes
**Qué**: en el input "Ubicación" del wizard, dropdown con las últimas 5 locations distintas usadas por el usuario.
**Datos**: extracción de `play.location` de la página 1 unfiltered.
**Esfuerzo**: bajo (full-client en `CreatePlayModal`).

### 3.3 [ ] Sugerir juegos recientes en el step 1
**Qué**: además de la búsqueda, mostrar 6-8 "Juegos recientes" basados en las últimas partidas del usuario.
**Datos**: `gameId` únicos de page 1 de partidas + cache de `/game/:id` ya populado.
**Esfuerzo**: bajo.

### 3.4 [ ] Rating del jugador (slider 1-10) en step 3
**Qué**: campo opcional "Mi rating de esta partida" (no del juego en general, sino de ESTA partida específica). Slider 1-10.
**Datos**: `player.rating` ya soportado en el backend.
**Esfuerzo**: bajo. Solo agregar el control en `CreatePlayModal` y al mapping del body.

### 3.5 [ ] Position drag-to-reorder en step 3
**Qué**: arrastrar jugadores para cambiar posición (1° → 2° → etc.).
**Datos**: `position` ya soportado.
**Esfuerzo**: medio. Necesita library de drag (react-dnd o similar) o handlers de drag nativos.

### 3.6 [ ] Color picker con paleta
**Qué**: dropdown con paleta de colores comunes (rojo/azul/verde/etc. + custom) en lugar de texto libre. Mejora consistencia y permite que el `colorDot` del modal de detalle siempre tenga match.
**Datos**: `player.color`.
**Esfuerzo**: bajo.

### 3.7 [ ] Validación: ganador único
**Qué**: warning suave si más de un jugador tiene `win=true` en juegos con `nowinstats=false` (por si fue accidental, salvo en juegos cooperativos).
**Esfuerzo**: bajo.

---

## 4. Descubrimiento

### 4.1 [ ] Hot list de BGG
**Qué**: widget en el dashboard con los juegos más "hot" en la comunidad BGG. Endpoint `/xmlapi2/hot?type=boardgame`.
**Datos**: directo de BGG (cache 1 hora).
**Esfuerzo**: bajo. Nuevo endpoint server + componente cliente.
**Dónde**: dashboard o nueva sección en `/bg-watch`.

### 4.2 [ ] Recomendaciones basadas en mecánicas
**Qué**: analizar mechanics/categories de los juegos más jugados del usuario y sugerir juegos similares.
**Datos**: `/xmlapi2/thing?id=X&stats=1` devuelve mechanics y categories. Top mechanics del usuario.
**Esfuerzo**: alto. Algoritmo de matching + cache pesado.

### 4.3 [ ] Detección de duplicados
**Qué**: al cargar una partida, si ya existe otra con (mismo gameId, misma fecha, ±1h de duración), warning "¿Ya cargaste esta partida?".
**Datos**: query local de partidas recientes.
**Esfuerzo**: bajo.

---

## 5. UX / Polish

### 5.1 [ ] Skeleton loaders en PartidasPanel y BgWatchPerGameView
**Qué**: reemplazar el dado 🎲 animado por skeleton shimmer cards (per memoria `skeleton_pattern.md`).
**Esfuerzo**: bajo. Hay un patrón estándar del proyecto.

### 5.2 [ ] Optimistic update en delete y edit
**Qué**: al confirmar delete, sacar la partida de la lista inmediatamente (no esperar al refetch). Si falla, revertir.
**Esfuerzo**: bajo.

### 5.3 [ ] Confirmación visual post-carga
**Qué**: toast "Partida cargada en BG Watch ✓" tras el éxito del POST, con link a la partida en BGG.com.
**Datos**: `playid` del response.
**Esfuerzo**: bajo. Usa `NotificationContext` existente.

### 5.4 [ ] Drafts / borrador de partida
**Qué**: si el usuario cierra el modal de carga a mitad de camino, ofrecer "Retomar borrador" la próxima vez. Guarda en localStorage.
**Esfuerzo**: bajo-medio.

### 5.5 [ ] Bulk delete
**Qué**: modo selección múltiple en `PartidasPanel` con checkbox → "Eliminar N partidas".
**Esfuerzo**: medio. Cuidado con rate limit de BGG al hacer N DELETEs seguidos.

### 5.6 [ ] Filtros server-side por jugador
**Qué**: en `PartidasPanel`, agregar filtro "Solo partidas con [Ana]". Hoy BGG no soporta este filtro server-side; sería client-side sobre las páginas cargadas, así que tiene la misma limitación que la vista "Por juego" (Slice 8).
**Esfuerzo**: medio. Idealmente se haría cargando todas las páginas con un loader visible.

### 5.7 [ ] Export a CSV
**Qué**: botón "Descargar mis partidas en CSV" para análisis offline en Excel.
**Esfuerzo**: bajo.

---

## Prioridad sugerida (próxima iteración)

Si tuviera que elegir 3-4 features para arrancar la próxima iteración, recomendaría:

1. **2.3 Linkear jugadores BGG → usuarios de Turnocero** — alto impacto social, conecta el feed de BG Watch con el resto del app.
2. **1.1 Heatmap calendario** — visualmente impactante, demuestra el valor de tener todos los plays trackeados.
3. **3.1 Autocomplete de amigos en CreatePlayModal** — quita la fricción más grande al cargar partidas en grupo.
4. **1.2 Head-to-head record** — feature divertido para grupos competitivos, alto engagement.

Las features de "estadísticas avanzadas" en general requieren cargar todas las páginas de plays. Para usuarios prolíficos esto puede ser lento o golpear rate-limits de BGG. Considerar un job de background que pre-procese y cachee las estadísticas por usuario (TTL 1h-24h), corriéndolo asincrónicamente al primer acceso al BG Watch.

---

## Limitaciones conocidas (no resolubles sin cambios en BGG)

- **BGG no devuelve hora de la partida**, solo fecha. Análisis de "hora típica" no es posible.
- **El XML API es read-only**; las escrituras siguen dependiendo de `geekplay.php` no documentado. Si BGG cambia su web, hay que actualizar.
- **No hay API oficial de OAuth para BGG**, lo que obliga a guardar la password del usuario. Si BGG agregara OAuth en el futuro, esta dependencia se evaporaría.
- **Rate limits de BGG no documentados**. Por las dudas, conservador: ≥2-5 seg entre requests, cache agresivo, jobs de background para operaciones bulk.
- **El batch endpoint `/thing?id=1,2,3` tiene un límite práctico de ~20 IDs**. Ya manejamos chunking en [server/routes/bgg.js](../../server/routes/bgg.js).

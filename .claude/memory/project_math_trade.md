---
name: project-math-trade
description: "Sección Math Trade (mergeada a master 2026-06-02, commit f890ef3 / merge 5463ed1) — intercambios múltiples de juegos con motor de matching de 3 modos (max/bounded/auto)"
metadata:
  node_type: memory
  type: project
  originSessionId: 8bcb51b4-2015-4bb3-9e66-48df60228e3a
---

Sección **Math Trade** (`/math-trade`), admin-managed como Torneos. Mergeada a master 2026-06-02 (commit `f890ef3`, merge `5463ed1`). Los usuarios **ofrecen** juegos y arman una **want list por juego ofrecido** (referenciada por TÍTULO = `bggGameId`, el matcher la expande a cualquier copia ofrecida de ese título por OTRO dueño). Un algoritmo calcula los intercambios óptimos en **ciclos**: si tu juego se va, recibís uno de tu want list (invariante: todo el que entrega, recibe).

**Modelos** (separados, no embebidos — espejo Torneo↔TorneoGame):

- `MathTrade`: title, description, image, `status` (`draft→open→locked→results→finished` + `cancelled`), `submissionDeadline`, `matching: { mode: max|bounded|auto, maxChainLength 2..12 }`, `published`, `lastRunAt`, `summary { itemsOffered, itemsTraded, cyclesCount, longestCycle, approximate, chosenChainLength }`.
- `MathTradeItem`: un doc por juego ofrecido (una copia). `mathtrade`, `owner`, `bggGameId`+snapshot `gameName/thumbnail` (vía `resolveGamesBatch`), `wants: [{ bggGameId, gameName, thumbnail, rank }]` (rank asc = preferencia), `notes`, + resultado `traded/givesToItem/receivesFromItem/matchedGameId`.

**Motor — `server/utils/mathTradeMatching.js`** (puro, sin Mongo). Input `[{ id, ownerId, gameId, wants:[{gameId,rank}] }]`. Tres engines:

- `solveUnbounded` (mode `max`): maximiza ítems intercambiados, cadenas de cualquier largo. **Exacto** — asignación de costo mínimo (Hungarian O(n³)): cada ítem "recibe" sí mismo (penalidad) o un ítem de su want list (costo = rank). La permutación garantiza el invariante. Es el problema clásico de TradeMaximizer.
- `solveBounded(items, K)` (mode `bounded`): max intercambios sin ciclo > K personas. **NP-hard** (cubrimiento de ciclos acotado = kidney-exchange). Pipeline: enumeración **justa** de ciclos ≤K (cap POR NODO de arranque, no global — evita el sesgo a índices bajos) → B&B exacto si es chico, si no **peeling greedy multi-start** (varias semillas, mejor cobertura) → **pasada final de peeling** que cubre nodos libres que la búsqueda se perdió. Flag `approximate` cuando no se prueba optimalidad.
- `solveAuto(items)` (mode `auto`, recomendado): techo = `solveUnbounded`; barre K=2..`AUTO_MAX_K`(10) y elige el **K más chico** cuyos intercambios llegan a ≥(1-`AUTO_TOLERANCE`=0.05)·techo; si ninguno llega, cae a ilimitado. → cadenas cortas/robustas sin perder intercambios. Devuelve `summary.chosenChainLength` (número, o null=ilimitado) + `curve`.

**Gotcha clave aprendido:** el enumerate-then-greedy ingenuo **colapsaba en grafos grandes y densos** (caso real: 5/178 intercambios) porque la enumeración global capada se concentraba en pocos nodos de índice bajo. El fix (cap por nodo + peeling con pasada de sobrantes) lo llevó a 168/178. El modo auto en ese mismo grafo eligió K=3 y consiguió 171 (cadenas cortas ganan al packing). Tests de regresión en `tests/unit/utils/mathTradeMatching.test.js` (cobertura ≥27/30 en grafo denso, auto elige K corto).

**Service `server/services/mathTradeService.js`:** `VALID_TRANSITIONS`, `runMatching`/`previewMatching` (preview NO persiste; enriquece ciclos con dueño+nombres), `clearResults`, `getResults` (rearma ciclos desde los refs persistidos), `runEngine` mapea mode→engine.

**Rutas `server/routes/mathtrade.js`:** `requireSection('mathtrade')`, detalle lectura pública (`optionalAuth`, draft oculto a no-admin). Ítems se cargan solo en `open` antes del deadline; snapshot BGG en POST/PUT. `PATCH /:id/status`: al pasar a `results` corre el matching (si falta) + `published=true` + notifica a cada dueño distinto; back-edges (draft/open/cancelled, results→locked) → `clearResults`. `POST /:id/run-matching` + `/preview`, `GET /:id/results`. Registrada en `app.js`.

**Notif `mathtrade_results`** (no-agregante): plumbeada en `Notification` model (campos `mathtradeId/mathtradeTitle`), `saveNotification` TYPE_TO_SECTION, cliente `notifDomains.js` (dominio `mathtrade`, icono `Swap` nuevo en NotifIcons, color `--green`, deep-link `/math-trade/:id`).

**Plumbing de sección:** `SiteConfig.SECTION_KEYS += 'mathtrade'` con `DEFAULT_ENABLED.mathtrade=false` (admin-only por defecto) — ídem `SiteConfigContext`. `PanelAdmin` SECTION_META, `Sidebar` ICONS+SECTIONS (slug `/math-trade`), `routing.js`, `App.jsx` (rutas; crear/editar con `<AdminRoute>`), `api/endpoints.js` `API.mathtrade.*`.

**Frontend `client/src/pages/mathtrade/`:** list, detail (tabs Mis ofertas / Participantes / Resultados + AdminPanel con toggle de modo, preview y publicar), create/edit (`MathTradeForm`, modo default `auto`), componentes `ItemForm`+`WantListBuilder` (reusan `BggGameSearch` con `clearOnPick`), `ResultsView`, `ChainVisualizer`, `UserBreakdown`. Helper `mathtradeStatus.js` (STATUS_META, MODE_LABEL). **Resultados tienen toggle "Por cadena / Por usuario"** — `UserBreakdown` agrupa por participante (entrega→recibe por ítem, incluye "sin match"); usa la lista completa de ítems si está, si no cae a las cadenas.

**Known issue (no fixeado):** `SectionGate` espera `SiteConfig.loaded` pero NO `AuthContext.loading`. En hard-reload / deep-link directo a una ruta gateada admin-only-por-defecto (math-trade, torneos, mesas, miFeed), un admin rebota a `/` antes de que cargue su sesión. La navegación in-app normal no se afecta. Fix sugerido: `if (authLoading) return null` en SectionGate.

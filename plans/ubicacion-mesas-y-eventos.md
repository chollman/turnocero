# Ubicación en mesas y eventos con distancias usuario ↔ item

## Estado al 2026-05-21

✅ **Done** — todas las fases ejecutadas, suite verde (1206 client + 426 server), deployable.

Cubre la migración de `Table.location` Y `Evento.location` a subdocumento con coords, el cálculo de distancias con Haversine, el filtro por radio en `/mesas` (pendiente en `/eventos`), y las iteraciones de UX en los forms (creación simplificada sin mapa, edición de Tables con mapa).

| Fase | Estado | Resultado |
|---|---|---|
| 0. Hook compartido `useDebouncedValue` | ✅ | Reusable para todo input → API (7/7 tests) |
| 1. Schema `Table.location` migrado | ✅ | `String` → `{ texto, lat, lng }` + lazy init hook (10/10 tests) |
| 2. Utility `haversineKm` | ✅ | `server/utils/geo.js` (13/13 tests) |
| 3. API tables actualizada | ✅ | `distanceKm` por item + filtro `?maxDistanceKm=` (27/27 tests, 8 nuevos) |
| 4. CreateTable + EditTable | ✅ | Reusan `PlaceAutocomplete` + `AddressMap` (11/11 tests) |
| 5. TableCard badge | ✅ | Badge verde de distancia + helper `formatDistanceKm` (24/24 tests, 4 nuevos) |
| 6. Dashboard radius slider | ✅ | Slider 0-100km con debounce 300ms + CTA "agregá dirección" (8/8 tests, 4 nuevos) |
| 7. TableDetail | ✅ | `location.texto` + distancia inline (42/42 tests) |
| 8. Botones −/+ en slider | ✅ | Fine-tune de a 1km, deshabilitados en extremos (13/13 tests, 5 nuevos) |
| 9. Simplificación CreateTable | ✅ | Removido mapa, location opcional, fallback a `user.direccion` server-side (10/10 client + 31/31 server tests, 8 nuevos) |
| 10. Refactor helpers a utils compartidos | ✅ | `utils/locationHelpers.js` + `utils/geo.js` extendido. Reuso entre tables + eventos (19/19 tests unitarios) |
| 11. Eventos: schema migration + lazy init hook | ✅ | `Evento.location` String → subdoc (4/4 tests) |
| 12. Eventos: API con distancia + JSON FormData | ✅ | POST/PUT acepta JSON string en FormData; GET con `distanceKm` + `?maxDistanceKm` (51/51 tests, 10 nuevos) |
| 13. EventoForm con PlaceAutocomplete | ✅ | Sin mapa (como CreateTable simplificado), hint condicional, location serializa como JSON en FormData (14/14 tests, 4 nuevos) |
| 14. Display: PosterCard, TimelineRow, EventoDetail | ✅ | Defensive `locationTexto` + distance badge inline (44/44 tests existentes + 3 nuevos en PosterCard) |

**Suite total final**: 1632 tests pasando (1206 client + 426 server). Cobertura mantenida >80% client.

## Decisiones tomadas

1. **Scope acotado**: solo Tables en este PR. Eventos = PR aparte siguiendo el mismo patrón.
2. **Sort default = "más recientes"** sigue siendo el de siempre. Distancia es un filtro opcional (slider), no cambia el orden por default.
3. **Sin mapa en TableDetail** — solo texto + badge de distancia (ahorra cuota de Map loads).
4. **Slider continuo de radio** (1-100km) con `useDebouncedValue(300ms)`, no chips de presets. Botones `−` y `+` a los lados para fine-tune de a 1km, deshabilitados en los extremos (0 y 100).
5. **Sin APIs nuevas en Google Maps** — Haversine puro alcanza para distancia "en línea recta".
6. **CreateTable simplificado**: mapa removido (era ruido visual para el flujo rápido de crear), ubicación opcional, fallback automático a `user.direccion` server-side. EditTable mantiene el mapa porque editar es un acto explícito de "quiero ajustar".

## Pieces clave

### Backend
- `server/utils/geo.js` — `haversineKm()` + `isValidCoord()` + `attachDistance()` + `buildBboxFilter()`.
- `server/utils/locationHelpers.js` — `normalizeLocationInput()` (acepta string, JSON string, u objeto) + `isEmptyLocation()` + `locationForCreate()` (fallback a user.direccion en POST). Compartido por Table y Evento.
- `server/models/{Table,Evento}.js` — `location: { texto, lat, lng }` + `pre('init')` hook que normaliza string legacy en cada uno.
- `server/routes/{tables,eventos}.js` — imports de los helpers; POST usa `locationForCreate` (fallback al perfil), PUT usa `normalizeLocationInput` puro (sin fallback). `GET` agrega `distanceKm` por item y soporta `?maxDistanceKm=N` (bbox + Haversine refine en memoria).

### Frontend
- `client/src/hooks/useDebouncedValue.js` — hook genérico, 300ms default. **Convención**: todo input → API debe usarlo.
- `client/src/utils/distance.js` — `formatDistanceKm()` con formato AR (`"Aquí mismo"` / `"850 m"` / `"12,3 km"` / `"250 km"`).
- `client/src/pages/dashboard/Dashboard.jsx` — search debounced + radius slider con botones −/+ + CTA al perfil.
- `client/src/pages/dashboard/TableCard.jsx` — badge verde de distancia.
- `client/src/pages/tables/CreateTable.jsx` — `<PlaceAutocomplete>` + fallback Buscar **sin mapa**. Hint condicional según `user.direccion`: muestra el texto del perfil como fallback o un link a `/perfil` si no tiene.
- `client/src/pages/tables/EditTable.jsx` — `<PlaceAutocomplete>` + `<AddressMap>` + fallback Buscar. Mantiene el mapa para fine-tuning visual al editar.
- `client/src/pages/eventos/EventoForm.jsx` — mismo patrón que CreateTable (sin mapa), serializa `location` como JSON string en FormData. Hint condicional. Usado para create + edit.
- `client/src/pages/eventos/{PosterCard,TimelineRow,EventoDetail}.jsx` — defensive `locationTexto` (handle string legacy o subdoc) + `formatDistanceKm(distanceKm)` inline en verde junto al lugar.

## Algoritmo de filtro por radio

Para evitar requerir índice 2dsphere + migración a GeoJSON Point:

1. Si `?maxDistanceKm=N` activo Y user tiene `direccion.lat`:
   - Bounding box: `lat ± N/111`, `lng ± N/(111*cos(lat))`.
   - Mongo find con `location.lat` y `location.lng` dentro del bbox + filtros base.
   - Refine Haversine en memoria, descartar > N km.
   - Paginar el resultado refinado.
2. Sin filtro: paginar en Mongo, agregar `distanceKm` solo a la página devuelta.

Esto escala bien porque el bbox reduce drásticamente el set antes del refine. Sin 2dsphere index, basta para Turnocero.

## Caveats

- Tables viejas mantienen su `location.texto` (string original migrado a subdoc) pero **sin coords** hasta que el host las edite picando una sugerencia del autocomplete o usando el botón Buscar.
- Filtro por radio EXCLUYE tables sin coords. Cuando esté activo, mesas viejas no aparecen.
- Haversine devuelve distancia "en línea recta" — no driving distance. Suficiente para "qué tan cerca" pero no para ETA.

## Pendientes (otros PRs)

- **Slider de radio en `/eventos`** (spawn-task ya en cola): el backend ya devuelve `distanceKm` + acepta `?maxDistanceKm` para eventos. Solo falta replicar el slider UI del Dashboard en `Eventos.jsx`.
- **Audit de inputs debounceables** (spawn-task ya en cola): refactorear todos los inputs en `client/src/` que disparen `/api/*` sin debounce para que usen `useDebouncedValue`. Sospechosos: `UsersList`, CreateTable BGG search, etc.
- **Backfill opcional de coords** en mesas/eventos viejos: script one-off que geocodee `location.texto` de items activos vía `/api/geocode` y guarde las coords. Decisión: ¿automático o lo dejamos para que el host las actualice manualmente?
- **Driving distance / ETA**: requeriría habilitar **Routes API** (USD 5/1000). Sustituiría o complementaría el Haversine en casos específicos (ej. "Mesas a menos de 30 min en auto").

## Referencias

- Memoria: [feedback_debounce_inputs.md](../.claude/memory/feedback_debounce_inputs.md), [feedback_google_maps_setup.md](../.claude/memory/feedback_google_maps_setup.md)
- Plan relacionado: [google-maps-migration.md](./google-maps-migration.md)
- Tests:
  - Backend: `server/tests/integration/{tables,eventos}.test.js`, `server/tests/unit/utils/{geo,locationHelpers}.test.js`, `server/tests/unit/models/{Table,Evento}.test.js`
  - Frontend: `Dashboard.test.jsx`, `TableCard.test.jsx`, `CreateTable.test.jsx`, `EditTable.test.jsx`, `TableDetail.test.jsx`, `EventoForm.test.jsx`, `PosterCard.test.jsx`, `useDebouncedValue.test.js`, `distance.test.js`

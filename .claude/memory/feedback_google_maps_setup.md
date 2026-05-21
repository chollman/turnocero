# Google Maps setup (Turnocero)

Reemplazó a Leaflet + Nominatim en 2026-05 (commit pendiente). Patrón establecido:

## Env vars

**Client** (`client/.env.local`, gitignored):
- `VITE_GOOGLE_MAPS_API_KEY` — browser key, restringida por referrer en Cloud Console. Habilitada para Maps JavaScript API + Places API (New).
- `VITE_GOOGLE_MAPS_MAP_ID_DARK` — Map ID con estilo dark.
- `VITE_GOOGLE_MAPS_MAP_ID_LIGHT` — Map ID con estilo light.

**Server** (`server/.env`, gitignored):
- `GOOGLE_MAPS_API_KEY` — server key, restringida por IP en Cloud Console. Solo Geocoding API.

Los Map IDs se manejan en Cloud Console (Map Styles); para cambiar la paleta visual del mapa NO se toca código, se edita el estilo en Cloud Console y se actualiza solo.

## Componentes compartidos

- `client/src/components/shared/AddressMap.jsx` — mapa con marker arrastrable. Props: `{ lat, lng, onChange, height }`. Lee `theme` del ThemeContext para alternar `mapId` (dark/light). Click en el mapa o drag del marker → `onChange(lat, lng)`.
- `client/src/components/shared/PlaceAutocomplete.jsx` — input con sugerencias usando Places API (New) + session tokens. Sesgo a Argentina (`includedRegionCodes: ['ar']`). Props: `{ value, onChange, onSelect, placeholder, disabled }`. `onSelect` recibe `{ lat, lng, formattedAddress, placeId }`.

Ambos componentes leen las envs **dentro del render** (no en top-level del módulo) para permitir override en tests con `vi.stubEnv`. Cada uno tiene su propio `<APIProvider>` (vis.gl deduplica la carga del script).

## Gotcha: el `mapId` no cambia in-place

Google Maps solo acepta `mapId` al construir el mapa — cambiar el prop después NO re-estiliza nada, el primer mapId queda fijo. vis.gl no remountea automáticamente. **Siempre pasar `key={mapId}` al `<Map>`** para forzar remount cuando cambia el tema (ver `AddressMap.jsx`).

## Gotcha: `colorScheme` es obligatorio con styles tipados

En el editor nuevo de Cloud Console, cada Map Style tiene un "Style type" (Light/Dark). Estos styles tipados **solo se aplican si pasás también `colorScheme="LIGHT"` o `"DARK"` al `<Map>`**. Sin esto, el Map ID + Style están perfectamente configurados pero el estilo NO se renderiza, cae al default. Aplicar siempre `colorScheme={theme === 'light' ? 'LIGHT' : 'DARK'}` junto con el `mapId`.

## Reuso en Tables y Eventos — 2026-05

Mismo patrón aplicado a `Table.location` Y `Evento.location`: migrado de `String` a `{ texto, lat, lng, displayName? }` con `pre('init')` hook para lazy upgrade. Forms reusan `<PlaceAutocomplete>` + `<AddressMap>` (Tables) / solo `<PlaceAutocomplete>` (Eventos). Distancia user↔item se calcula con **Haversine puro** (sin APIs de Google) en `server/utils/geo.js`, expuesta como `distanceKm` en cada item de `GET /api/tables` y `GET /api/eventos`, con filtro server-side `?maxDistanceKm=N` (bbox + refine en memoria, sin requerir 2dsphere). UI: badge verde via helper `client/src/utils/distance.js#formatDistanceKm` ("850 m" / "12,3 km" / "250 km" — `null` para 0 y distancias < 10m que redondean a 0). Slider de radio en dashboard con `useDebouncedValue(300ms)`.

**Diferencias entre Tables y Eventos**:
- Tables: location opcional, fallback al `user.direccion` en POST (no en PUT). Edit con `<AddressMap>` visual.
- Eventos: location **obligatoria** (sin fallback), validación tanto en frontend (handleSubmit) como server (POST/PUT). Form sin mapa.
- Eventos suma `location.displayName` (opcional, max 100): alias del lugar que reemplaza al `texto` formateado en cards/listas (ej. "Bar de Pepe" en vez de "Av. X 1234, CABA"). La dirección real sigue usándose para distancia y mapa.

## Helpers de display de location

`client/src/utils/location.js`:
- `formatLocation(texto, mode)` — modos: `fullAddress` (default), `city` (solo localidad, strippea código postal AR), `regular` (calle + ciudad sin provincia/país). Heurística: descarta país (Argentina/Uruguay/Chile/Brasil) + provincia (`"Provincia de X"`, `"X Province"`), agarra último elemento → ciudad. Funciona con string libre (sin comas → devuelve tal cual).
- `getLocationDisplay(location, mode)` — wrapper que respeta `location.displayName` si está seteado, sino cae a `formatLocation(location.texto, mode)`. **Usar este helper en componentes de display** en vez de `formatLocation` directo — centraliza la lógica del override.

Convención de display por superficie:
- **Listas/cards**: `getLocationDisplay(loc, 'city')` — máxima brevedad.
- **Detalle**: `getLocationDisplay(loc, 'regular')` — calle + ciudad.
- **Tooltip `title`**: siempre `loc.texto` crudo para que el user pueda ver la dirección completa.

## Backend geocoding cache (mismo patrón que BGG)

- `server/models/GeocodeCache.js` — `{ query, lat, lng, formatted, lastFetchedAt }` con índice TTL de 30 días.
- `GET /api/geocode?q=` — auth requerida, rate-limited (30/min por user). Cache-first: hit → devuelve cacheado; miss → llama Google Geocoding API, guarda y devuelve. Query normalizada (lower + trim + colapsar espacios) para máximo hit-rate.
- Sesgo: `region: 'ar'`, `language: 'es'`.

## UX en UserProfile

1. **Primary**: `PlaceAutocomplete` → usuario tipea, pica sugerencia → `onSelect` setea texto + lat + lng. Sin call a `/api/geocode` (Places API devuelve coords).
2. **Fallback**: botón "Buscar" → llama `/api/geocode` con lo que tipeó (caso: el user no quiere las sugerencias o copió un texto suelto).
3. **Map interaction**: click/drag → solo actualiza lat/lng, texto queda como esté.

## Testing

- `@vis.gl/react-google-maps` se mockea como stubs livianos (`APIProvider` = passthrough, `Map` = div con `data-*`, etc).
- `useMapsLibrary` se mockea con un objeto que tiene `AutocompleteSuggestion.fetchAutocompleteSuggestions` y `AutocompleteSessionToken`.
- Para Places: usar `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync(ms)` (sino los `waitFor` se cuelgan porque el debounce de 300ms compite con el polling de waitFor).
- En tests de UserProfile: mockear `AddressMap` y `PlaceAutocomplete` como divs simples — los componentes tienen sus propios tests.
- Server geocode: parchear `Client.prototype.geocode = vi.fn()` antes de cada test.

## Costos

- Maps JS API: 1000/día tope (free credit: 28k/mes).
- Geocoding API: 1000/día tope. Con cache TTL 30d casi nunca llega a Google.
- Places API (New): autocomplete = gratis con session token; GetPlace = USD 5/1000 (~500/día tope).

Cuotas duras seteadas en Cloud Console — al límite, costo máximo total ~USD 3/día.

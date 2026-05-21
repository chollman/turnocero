# Migración Leaflet → Google Maps (perfil de usuario)

## Estado al 2026-05-21

✅ **Done** — todas las fases ejecutadas, suite verde, deployable.

| Fase | Estado | Resultado |
|---|---|---|
| 0. Setup Cloud Console | ✅ | Browser key + server key + 2 Map IDs + 2 Styles (Dark/Light) |
| 1. Install deps | ✅ | `@vis.gl/react-google-maps` (client) + `@googlemaps/google-maps-services-js` (server); `leaflet` removido |
| 2. Backend geocode endpoint | ✅ | `GeocodeCache` model + `GET /api/geocode` con caché Mongo TTL 30d (7/7 tests) |
| 3. AddressMap component | ✅ | Map con marker draggable + dark/light auto (10/10 tests) |
| 4. PlaceAutocomplete component | ✅ | Places API (New) + session tokens + sesgo a AR (9/9 tests) |
| 5. UserProfile integration | ✅ | Replace Leaflet+Nominatim; tests actualizados (23/23) |

## Decisiones tomadas

- **Geocoding server-side con caché Mongo** (no client-side) — patrón consistente con BGG cache, key oculta, cuota controlada.
- **Places Autocomplete en el mismo PR** que la migración — mejor UX que el input + botón Buscar viejo.
- **2 Map IDs** (uno dark, uno light) con styles asociados en Cloud Console — sin hardcodear JSON en código, cambios visuales sin redeploy.
- **Restricciones de keys**: browser por HTTP referrers, server por IP (en prod = IPs outbound de Render).

## Componentes shared creados

- `client/src/components/shared/AddressMap.jsx` + `AddressMap.module.css`
- `client/src/components/shared/PlaceAutocomplete.jsx` + `PlaceAutocomplete.module.css`

Cada uno envuelve su propio `<APIProvider>` (vis.gl deduplica la carga del script).

## Backend

- `server/models/GeocodeCache.js` — `{ query, lat, lng, formatted, lastFetchedAt }` con TTL index 30d.
- `server/routes/geocode.js` — `GET /api/geocode?q=` auth-required, rate-limited (30/min/user), cache-first.
- Sesgo: `region: 'ar'`, `language: 'es'`.

## Gotchas descubiertos (en memoria también)

1. **`mapId` no cambia in-place**: Google Maps solo acepta `mapId` al construir; sin `key={mapId}` el primer style queda fijo.
2. **`colorScheme` es obligatorio con styles tipados**: en el editor nuevo de Cloud Console, los styles tienen tipo (Light/Dark) y solo se aplican si pasás `colorScheme="LIGHT"` o `"DARK"` al `<Map>`.
3. **Vite + `vi.stubEnv`**: leer `import.meta.env` dentro del render (no top-level) para permitir override en tests.
4. **REQUEST_DENIED** con IP restriction: en dev local, la IP de Render no aplica — usar "None" en dev o agregar IP de casa.
5. **Confusión Map ID vs Style ID**: los Style IDs (24 chars hex) NO sirven como `mapId`; hay que crear Map IDs en Map Management (12-16 chars hex) y asociarles el Style.

## Costos

- Free tier de USD 200/mes cubre con creces el uso esperado de Turnocero.
- Cuotas duras seteadas en Cloud Console: 1000/día para Maps JS, Geocoding y GetPlace.
- Autocomplete = gratis con session token, pago solo cuando se confirma con GetPlace.

## Referencias

- Memoria: [feedback_google_maps_setup.md](../.claude/memory/feedback_google_maps_setup.md)
- Tests: `AddressMap.test.jsx`, `PlaceAutocomplete.test.jsx`, `UserProfile.test.jsx`, `geocode.test.js`

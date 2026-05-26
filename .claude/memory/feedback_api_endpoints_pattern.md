---
name: feedback-api-endpoints-pattern
description: "All client HTTP paths must go through `client/src/api/endpoints.js` (`API.x.Y`); no literal `/api/...` strings in new code"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 92c9193d-d562-4786-a099-944475d22163
---

# API endpoints centralization (tech-debt P4.4)

**Desde:** 2026-05-22 — el módulo `client/src/api/endpoints.js` es la fuente única de verdad de paths HTTP del cliente. Cualquier llamada a la API nueva debe usar `API.x.Y` en vez de strings literales.

## El módulo

```js
import { API } from "../api/endpoints";

// Constantes para paths fijos:
axios.get(API.notifications.LIST); // -> /api/notifications

// Builders (funciones) para paths con params:
axios.get(API.bgg.PARTIDAS("claudio")); // -> /api/bgg/partidas/claudio
axios.patch(API.dm.READ(userId)); // -> /api/dm/<userId>/read
axios.delete(API.compartidas.DETAIL(id)); // -> /api/compartidas/<id>
```

Namespace por dominio: `auth`, `bgg`, `tables`, `compartidas`, `noticias`, `torneos`, `eventos`, `friends`, `notifications`, `dm`, `adminChat`, `siteConfig`, `users`, `admin`, `geocode`, `health`. Endpoints fijos = `'string'`, paths con params = `(id, ...) => 'string'`. Builders pasan los params por `encodeURIComponent` defensivamente — bggUsernames pueden tener caracteres especiales y los IDs vienen de URLs.

## Convenciones

- **Query strings NO van en el builder.** Usá `axios.get(API.x.Y(id), { params })` en vez de meter `?foo=bar` en el path.
- **Nada de string concat sobre los paths.** Si no existe el builder, agregalo al módulo.
- **Tests son la primera línea de defensa**: `endpoints.test.js` tiene un "sanity check" que walkea el árbol y se asegura de que ningún path se rompa o quede como `/api/api/...`.

## Estado de la migración

**Cerrado al 2026-05-22.** Toda la production code del cliente usa `API.x.Y`. Si encontrás un `/api/...` literal en algún `.jsx`/`.js`/`.tsx` (no test, no comment), es un bug.

Quedó intencionalmente fuera del módulo:

- **Tests** (`*.test.jsx`, `test/server.js`): MSW handlers necesitan strings concretos para matchear paths. Migrarlos agrega indirección sin valor.
- **AuthContext interceptor** (`err.config?.url?.includes('/api/auth/')`): es path-prefix check sobre URLs reales en runtime, no un call.
- **Comments** en `useApi.js`, `useDebouncedValue.js`, etc.: ejemplos de docs.
- pages/eventos/EventoDetail, EventoForm, EventoInscripciones
- pages/torneos/TorneoDetail, CreateTorneo, AddParticipantModal
- pages/compartidas/CompartidaPost, CompartidaCard sub-componentes
- pages/messages/Messages, DirectChat
- pages/admin/DatabaseViewer
- components/chat/ChatLauncher
- components/shared/BggGameSearch

Los **tests** (vitest + MSW) NO se migran — siguen con strings literales porque MSW handlers necesitan strings concretos para matchear y meter funciones del módulo agrega indirección sin valor.

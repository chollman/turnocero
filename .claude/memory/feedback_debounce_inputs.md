---
name: feedback-debounce-inputs
description: "Controlled inputs whose value drives an `/api/*` fetch must use `client/src/hooks/useDebouncedValue` (300ms default, 500ms for expensive fetches); never re-implement setTimeout+useRef"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 92c9193d-d562-4786-a099-944475d22163
---

# Debounce de inputs que pegan al backend

**Regla (2026-05)**: cualquier input controlado cuyo value alimente un fetch a `/api/*` debe usar el hook compartido `client/src/hooks/useDebouncedValue` para evitar disparar un request por keystroke.

## Patrón estándar

```jsx
import useDebouncedValue from "../../hooks/useDebouncedValue";

const [query, setQuery] = useState("");
const debouncedQuery = useDebouncedValue(query, 300);

useEffect(() => {
  if (debouncedQuery.trim()) fetchResults(debouncedQuery);
}, [debouncedQuery]);
```

## Defaults

- **300ms** para text inputs de búsqueda/filtro (default del hook).
- **500ms** para fetches caros (agregaciones, sorts pesados, server-side joins).

Pasar el segundo argumento explícito cuando se aparte del default: `useDebouncedValue(value, 500)`.

## Qué NO hacer

- ❌ Re-implementar `setTimeout` + `useRef` manual (como hacía `Dashboard.jsx` antes).
- ❌ Disparar el fetch en `onChange` directo del input.
- ❌ Mezclar fake timers con `waitFor` en tests sin `vi.advanceTimersByTimeAsync` — se cuelga.

## Casos especiales

- **Sliders**: aplicar el mismo patrón. El `value` del slider hace `setRadiusKm`, `useDebouncedValue(radiusKm, 300)` driveea el re-fetch. La UI muestra el valor INMEDIATO (no debounced) para feedback visual.
- **Autocompletes de Google Places**: `PlaceAutocomplete` ya tiene su propio debounce interno (300ms hardcoded) — no aplicar `useDebouncedValue` por afuera.
- **DateTimePicker shared**: NO usa debounce. El user pickea valores discretos (día, hora) que disparan onChange inmediato.

Ver también: [feedback_google_maps_setup.md](feedback_google_maps_setup.md) para Places Autocomplete.

---
name: feedback-react-router-search-params
description: useSearchParams de react-router-dom no dispara re-render en este proyecto cuando se llama setSearchParams — usar useState como fuente única + sync manual via useLocation + history.replaceState.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 12809272-6ba5-42b7-9140-52782f4d77f7
---

`useSearchParams` (react-router-dom v6 en este repo) actualiza la URL al llamar `setSearchParams`, pero **no dispara re-render** del componente que llamó al setter. El siguiente render lee el `searchParams` viejo y la UI no cambia. Solo un refresh manual o un cambio del path completo "ve" el nuevo valor.

**Síntoma típico:** click en una tab/filtro que usa `?param=` cambia la URL pero el contenido no se actualiza; refrescar la pantalla sí muestra el nuevo estado.

**Why:** Versión actual de `react-router-dom` o cómo está montado el Router en `App.jsx` — no profundicé en la causa root, pero el patrón useState + sync manual es la solución confiable.

**How to apply:** Para query params que necesiten ser reactivos:

```js
import { useLocation } from "react-router-dom";

const location = useLocation();
const VALID = ["a", "b", "c"];

// Source of truth: useState. Init lee de URL (deep-link OK).
const [tab, setTabState] = useState(() => {
  const url = new URLSearchParams(window.location.search).get("tab");
  return VALID.includes(url) ? url : "a";
});

// Sync back/forward del browser: useLocation SÍ es reactivo.
useEffect(() => {
  const url = new URLSearchParams(location.search).get("tab");
  const valid = VALID.includes(url) ? url : "a";
  setTabState((prev) => (prev === valid ? prev : valid));
}, [location.search]);

// Setter público: state + URL via replaceState (sin entrada en history).
const setTab = (next) => {
  setTabState(next);
  const params = new URLSearchParams(window.location.search);
  if (next === "a") params.delete("tab");
  else params.set("tab", next);
  const search = params.toString();
  window.history.replaceState(
    null,
    "",
    search ? `${location.pathname}?${search}` : location.pathname,
  );
};
```

**No usar** `useSearchParams` para casos que dependan de re-render — el `setSearchParams` queda silencioso. Sí sirve para LEER el query string al mount (alternativa a `window.location.search`), pero para escribir + reaccionar, este patrón.

**Aplicado en:** [EventoDetail.jsx](client/src/pages/eventos/EventoDetail.jsx) (tabs `?tab=detalle|ludoteca|mesas`). Si otros componentes nuevos lo necesitan, copiar el patrón hasta tener 3+ usuarios y extraer a un hook compartido.

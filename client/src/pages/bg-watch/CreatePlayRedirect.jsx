import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/**
 * Entrada SIN username a la carga de partidas (`/bg-watch/partidas/nueva`).
 *
 * El link de carga no debería depender de quién lo comparta: este redirector
 * resuelve al usuario autenticado y lo manda a SU propia página de carga
 * (`/bg-watch/:bggUsername/partidas/nueva`), conservando el query string
 * (`?juego`, `?volver`) y el `state` (prefill de partida compartida). Así el
 * mismo link sirve para cualquiera que lo reciba.
 *
 * Va envuelto en `<PrivateRoute>` (garantiza usuario logueado) en App.jsx, así
 * que acá `user` siempre existe; sólo resta el caso "sin cuenta de BGG" → al hub.
 */
export default function CreatePlayRedirect() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user?.bggUsername) return <Navigate to="/bg-watch" replace />;

  return (
    <Navigate
      to={`/bg-watch/${user.bggUsername}/partidas/nueva${location.search}${location.hash}`}
      state={location.state}
      replace
    />
  );
}

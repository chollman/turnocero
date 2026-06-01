import ErrorScreen from "./ErrorScreen";

/**
 * Pantalla 500. La rinde el <ErrorBoundary> global ante un crash de render
 * (o se puede montar en una ruta). Es auto-contenida: no depende de Router ni
 * de contextos que podrían ser justamente lo que falló.
 *
 *  - onRetry: reintento. Por defecto recarga la página (limpia estado corrupto).
 *    El boundary inyecta su propio reset acá.
 *  - onHome: navegación al inicio con reload completo (recomendado para
 *    descartar estado corrupto), sobreescribible para tests.
 */
export default function ServerError({ onRetry, onHome }) {
  const retry = onRetry || (() => window.location.reload());
  const home = onHome || (() => window.location.assign("/"));

  return <ErrorScreen variant="500" onPrimary={retry} onSecondary={home} />;
}

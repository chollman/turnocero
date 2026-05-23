import { useEffect } from "react";

// Helper interno: registra un map { event → handler } sobre un socket y
// limpia con socket.off(...) al unmount o cuando alguno de los deps cambia.
//
// Cada hook por dominio usa esto para evitar repetir el for...off pattern.
// `handlersFactory` debe devolver el map; lo llamamos dentro del useEffect
// para que las clausuras capturen las refs/setters correctas.
//
// `deps` debe contener cada referencia que use la factory. Pasalo siempre
// (incluso si parece "estable") — son refs/setters que React garantiza
// estables, así que el useEffect solo correrá una vez por socket-life.
export function useSocketListeners(socket, handlersFactory, deps) {
  useEffect(() => {
    if (!socket) return undefined;
    const handlers = handlersFactory();
    for (const [event, handler] of Object.entries(handlers)) {
      socket.on(event, handler);
    }
    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        if (typeof socket.off === "function") socket.off(event, handler);
      }
    };
    // El factory cambia en cada render — confiamos en `deps` (que provee
    // el hook caller) para decidir cuándo re-registrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, ...deps]);
}

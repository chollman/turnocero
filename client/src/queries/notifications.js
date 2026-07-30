import { useQuery } from "@tanstack/react-query";

export const notificationsKeys = {
  all: ["notifications"],
  list: (userId) => [...notificationsKeys.all, "list", userId ?? null],
};

// Cache-only: no hay queryFn real. La carga inicial (GET /api/notifications)
// y toda actualización en vivo (sockets, markRead*, dismiss, ...) escriben
// acá vía queryClient.setQueryData desde NotificationContext — este hook
// solo suscribe al cache para leerlo reactivamente ("Query as a store",
// patrón documentado de TanStack Query).
//
// A propósito NO se usa un queryFn que haga el fetch: si el boot fetch
// commitea su resultado como valor de retorno de queryFn, ese commit puede
// pisar con datos viejos una escritura de socket/markRead que llegó
// mientras el fetch estaba en vuelo (el commit usa el snapshot que el
// queryFn leyó al arrancar, no el cache más reciente). Haciendo el merge
// del boot fetch con el updater FUNCIONAL de setQueryData (ver
// NotificationContext.jsx) esa lectura es atómica con la escritura.
export function useNotificationsQuery(userId) {
  return useQuery({
    queryKey: notificationsKeys.list(userId),
    queryFn: () => [],
    enabled: false,
  });
}

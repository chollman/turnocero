import { useEffect, useLayoutEffect, useRef } from "react";
import { io } from "socket.io-client";

/**
 * Custom hook que monta una conexión Socket.IO para el detalle de un evento
 * y se suscribe a los broadcasts del room `evento:<id>`. Los callbacks se
 * guardan en refs así que el effect solo depende de `id` — no reconecta el
 * socket cada vez que cambia la closure de los handlers, y no necesita el
 * eslint-disable de exhaustive-deps que tenía el effect inline.
 *
 * Contrato del server (ver server/routes/eventos.js):
 *   - `evento:counts-changed`  → payload: { eventoId, counts }
 *   - `evento:registration-reviewed` → payload: { eventoId, userId, registrationId,
 *        status, reviewedAt, adminNotes, permanentlyRejected, counts, registration }
 *   - `evento:updated` → payload: { eventoId, evento }
 *   - `evento:ludoteca-changed` → payload: { eventoId, action: 'added'|'updated'|'removed', item?, itemId? }
 *   - `evento:mesa-created` → payload: { eventoId, tableId }
 *
 * Si el cliente no tiene token guardado (logout / sesión expirada) el hook
 * no abre socket y los callbacks nunca se llaman.
 *
 * @param {string} id - ObjectId del evento. Si cambia, se desconecta y reconecta.
 * @param {object} callbacks
 * @param {(payload: object) => void} [callbacks.onCountsChanged]
 * @param {(payload: object) => void} [callbacks.onReviewed]
 * @param {(payload: object) => void} [callbacks.onUpdated]
 * @param {(payload: object) => void} [callbacks.onLudotecaChanged]
 * @param {(payload: object) => void} [callbacks.onMesaCreated]
 */
export default function useEventoSocket(
  id,
  {
    onCountsChanged,
    onReviewed,
    onUpdated,
    onLudotecaChanged,
    onMesaCreated,
  } = {},
) {
  const cbRef = useRef({
    onCountsChanged,
    onReviewed,
    onUpdated,
    onLudotecaChanged,
    onMesaCreated,
  });
  // Actualizar refs después del commit — los listeners usan la versión más
  // reciente del callback, pero NO disparan reconexión del socket.
  // useLayoutEffect (en vez de asignar durante render) cumple con la regla
  // react-hooks/refs y queda sincrónico antes de cualquier paint.
  useLayoutEffect(() => {
    cbRef.current = {
      onCountsChanged,
      onReviewed,
      onUpdated,
      onLudotecaChanged,
      onMesaCreated,
    };
  });

  useEffect(() => {
    if (!id) return undefined;
    const token =
      typeof window !== "undefined"
        ? window.localStorage?.getItem("token")
        : null;
    if (!token) return undefined;

    const socketUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
    const socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket"],
    });
    socket.on("connect", () => socket.emit("join:evento", id));

    socket.on("evento:counts-changed", (payload) => {
      if (payload?.eventoId !== id) return;
      cbRef.current.onCountsChanged?.(payload);
    });
    socket.on("evento:registration-reviewed", (payload) => {
      if (payload?.eventoId !== id) return;
      cbRef.current.onReviewed?.(payload);
    });
    socket.on("evento:updated", (payload) => {
      if (payload?.eventoId !== id) return;
      cbRef.current.onUpdated?.(payload);
    });
    socket.on("evento:ludoteca-changed", (payload) => {
      if (payload?.eventoId !== id) return;
      cbRef.current.onLudotecaChanged?.(payload);
    });
    socket.on("evento:mesa-created", (payload) => {
      if (payload?.eventoId !== id) return;
      cbRef.current.onMesaCreated?.(payload);
    });

    return () => {
      socket.emit("leave:evento", id);
      socket.disconnect();
    };
  }, [id]);
}

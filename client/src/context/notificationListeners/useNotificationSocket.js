import { useEffect, useState } from "react";
import { io } from "socket.io-client";

// Maneja el lifecycle de la conexión Socket.IO: connect cuando hay user,
// disconnect en cleanup (incluido logout). Devuelve la instancia del socket
// (o null si no hay user) para que los hooks de listeners se attacheen.
//
// El socket se recrea solo cuando cambia `user` — los re-renders normales
// del provider no reciclan la conexión.
export function useNotificationSocket(user) {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) {
      setSocket(null);
      return undefined;
    }
    const token = localStorage.getItem("token");
    const socketUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
    const instance = io(socketUrl, {
      auth: { token },
      transports: ["websocket"],
    });
    setSocket(instance);
    return () => {
      instance.disconnect();
      setSocket(null);
    };
  }, [user]);

  return socket;
}

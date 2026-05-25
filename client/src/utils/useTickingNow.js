import { useState, useEffect } from "react";

// Re-renderiza el componente cada `intervalMs` actualizando el state `now`.
// Útil para countdowns y "hace X minutos" sin tener que llamar Date.now() en
// render (rompe react-hooks/purity). Default 30s — suficiente para countdowns
// de eventos sin presionar al GC.
export default function useTickingNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

import { useEffect, useState } from "react";
import axios from "axios";
import { API } from "../api/endpoints";

// Fetch del showcase (mesa random + total) usado en las 5 auth pages
// (Login, Register, ForgotPassword, ResetPassword, VerifyEmail). Antes
// cada página repetía: useState para showcase + useState para seed +
// useEffect con axios.get + catch silencioso. Acá vive la lógica
// completa en un solo lugar.
//
// `seed` es un entero estable (no cambia entre renders) usado para
// elegir un GameTile aleatorio del tile-set — la inestabilidad entre
// pages confundía al usuario al navegar Login → Register.
//
// `enabled` es opcional (default true). Login lo usa para suprimir
// el fetch hasta que SiteConfig confirme que la sección 'mesas' está
// activada — sin eso, un admin que apaga la sección igual dispararía
// el request en la página pública de login.
//
// Errores se ignoran intencionalmente: la UI tiene fallbacks (tile de
// "TurnoCero" cuando no hay showcase). No queremos un toast bloqueando
// el flujo de auth si la API está rota.

// `refreshMs` (opcional) re-fetchea cada N ms para rotar la mesa que se muestra
// en el showcase (el endpoint devuelve una mesa random por llamada). Default 0
// = una sola lectura, comportamiento histórico para los otros 4 callers.
export function useShowcaseTables({ enabled = true, refreshMs = 0 } = {}) {
  const [showcase, setShowcase] = useState(null);
  const [seed] = useState(() => Math.floor(Math.random() * 100));

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const fetchOne = () => {
      axios
        .get(API.tables.SHOWCASE)
        .then(({ data }) => {
          if (!cancelled) setShowcase(data);
        })
        .catch(() => {
          /* fallback en UI */
        });
    };
    fetchOne();
    const id = refreshMs > 0 ? setInterval(fetchOne, refreshMs) : null;
    return () => {
      cancelled = true;
      if (id) clearInterval(id);
    };
  }, [enabled, refreshMs]);

  return { showcase, seed };
}

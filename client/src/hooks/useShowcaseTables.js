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

export function useShowcaseTables({ enabled = true } = {}) {
  const [showcase, setShowcase] = useState(null);
  const [seed] = useState(() => Math.floor(Math.random() * 100));

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    axios
      .get(API.tables.SHOWCASE)
      .then(({ data }) => {
        if (!cancelled) setShowcase(data);
      })
      .catch(() => {
        /* fallback en UI */
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { showcase, seed };
}

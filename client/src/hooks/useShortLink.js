// Hook para enganchar un short link a los controles de compartir de un recurso,
// de forma transparente: mientras no resuelve, el caller usa el link largo;
// cuando resuelve, `shortUrl` pasa a ser el corto y los `<a href>` se actualizan.
//
//   const { shortUrl, prime } = useShortLink({ type: "compartida", ref: id });
//
// - Páginas de detalle (un solo recurso): pasar `eager: true` → resuelve en
//   mount (barato), así los enlaces ya llevan el corto al primer click.
// - Tarjetas de feed (N recursos): dejarlo perezoso y enganchar `prime` a
//   onPointerEnter / onFocusCapture / onPointerDown del grupo de compartir, para
//   no mintear un código por cada tarjeta al montar el feed.

import { useCallback, useEffect, useRef, useState } from "react";
import { getShortUrl } from "../utils/shortlink";

export function useShortLink({ type, ref, eager = false }) {
  const [shortUrl, setShortUrl] = useState(null);
  // Evita disparos repetidos para el mismo (type, ref) y setState tras unmount.
  const requestedRef = useRef(false);
  const mountedRef = useRef(true);

  // Reset si cambia el recurso.
  useEffect(() => {
    requestedRef.current = false;
    setShortUrl(null);
  }, [type, ref]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const prime = useCallback(() => {
    if (requestedRef.current || !type || !ref) return;
    requestedRef.current = true;
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    getShortUrl({ type, ref, origin }).then((url) => {
      if (url && mountedRef.current) setShortUrl(url);
    });
  }, [type, ref]);

  useEffect(() => {
    if (eager) prime();
  }, [eager, prime]);

  return { shortUrl, prime };
}

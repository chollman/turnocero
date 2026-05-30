import { useEffect, useRef } from "react";

/**
 * Infinite-scroll vía IntersectionObserver. Devuelve un `ref` que tenés que
 * colgar de un elemento "sentinel" al final (o donde quieras gatillar) de una
 * lista paginada. Cuando el sentinel entra en el viewport, llama `onLoadMore`.
 *
 * Pensado para listas que crecen en el flujo normal de la página (no en un
 * contenedor scrolleable con altura fija): `root: null` observa contra el
 * viewport. `rootMargin` pre-carga la próxima tanda un poco antes de llegar al
 * borde para que el scroll se sienta continuo.
 *
 * `onLoadMore` debería ser estable (useCallback) y/o guardar internamente
 * contra cargas en curso o sin más páginas. `enabled` permite apagar el
 * observer cuando ya no hay más para traer (evita gatillos al vacío).
 *
 * Uso típico:
 *   const onLoadMore = useCallback(() => {
 *     if (!loadingMore && page < pages) load(page + 1, false);
 *   }, [loadingMore, page, pages]);
 *   const sentinelRef = useInfiniteScroll(onLoadMore, { enabled: page < pages });
 *   ...
 *   {page < pages && <div ref={sentinelRef} />}
 *
 * `root` (opcional) es el contenedor scrolleable contra el cual observar — útil
 * cuando la lista vive en una caja con `overflow:auto` y altura limitada (en vez
 * del viewport). Pasá el ref del contenedor; se lee `.current` dentro del effect
 * (post-commit, ya montado). `null` → observa contra el viewport.
 *
 * @param {() => void} onLoadMore  callback a disparar al intersectar
 * @param {{ enabled?: boolean, root?: object|Element|null, rootMargin?: string }} [opts]
 * @returns {import("react").RefObject<HTMLElement>}  ref para el sentinel
 */
export default function useInfiniteScroll(
  onLoadMore,
  { enabled = true, root = null, rootMargin = "200px" } = {},
) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;

    const rootEl = root && "current" in root ? root.current : root;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
      { root: rootEl || null, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled, onLoadMore, rootMargin, root]);

  return sentinelRef;
}

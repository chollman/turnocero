import { useEffect, useState } from 'react';

/**
 * Devuelve la versión "estabilizada" de `value`: solo se actualiza después
 * de que el valor entrante deje de cambiar por `delayMs` milisegundos.
 *
 * Pensado para inputs controlados que disparan fetches al backend. Sin
 * debounce, cada keystroke pegaría a `/api/*` — con esto, solo se dispara
 * cuando el usuario "para de tipear".
 *
 * Uso típico:
 *   const [query, setQuery] = useState('');
 *   const debouncedQuery = useDebouncedValue(query, 300);
 *   useEffect(() => {
 *     if (debouncedQuery.trim()) fetchResults(debouncedQuery);
 *   }, [debouncedQuery]);
 *
 * Defaults:
 *   - 300ms para text inputs (búsquedas rápidas).
 *   - 500ms para fetches caros (sort+filter pesados, agregaciones).
 *
 * @template T
 * @param {T} value     valor controlado actual
 * @param {number} delayMs    ms a esperar después del último cambio
 * @returns {T}    último valor estabilizado
 */
export default function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}

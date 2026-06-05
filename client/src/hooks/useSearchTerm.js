import useDebouncedValue from "./useDebouncedValue";

/**
 * Término de búsqueda listo para pegarle al backend: debounce + umbral mínimo
 * de caracteres. Misma idea que el buscador de juegos de BGG (`BggGameSearch`,
 * `minChars = 3`): no buscar con cada tecla y recién disparar cuando hay algo
 * que valga la pena buscar.
 *
 * Devuelve el término **estabilizado y recortado** SOLO si alcanza `minChars`;
 * si no, devuelve "". Esto deja que el caller distinga dos casos con una sola
 * variable:
 *   - "" → mostrar la lista por defecto (sin filtro) y NO refetchear por 1-2
 *     letras tipeadas.
 *   - término ≥ minChars → buscar.
 *
 * Uso típico:
 *   const [q, setQ] = useState("");
 *   const searchTerm = useSearchTerm(q);            // 3 chars / 300ms
 *   useEffect(() => { fetchPage(1, false); }, [searchTerm]);
 *   // ...params: { q: searchTerm || undefined }
 *
 * @param {string} value     valor controlado del input
 * @param {{ minChars?: number, delayMs?: number }} [opts]
 * @returns {string}    término debounced+trim si ≥ minChars, si no ""
 */
export default function useSearchTerm(
  value,
  { minChars = 3, delayMs = 300 } = {},
) {
  const debounced = useDebouncedValue(value, delayMs);
  const trimmed = (debounced || "").trim();
  return trimmed.length >= minChars ? trimmed : "";
}

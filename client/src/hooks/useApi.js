import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "../utils/getErrorMessage";

// Hook genérico para invocar una función async (típicamente un axios call)
// y manejar loading/error/data en un único lugar. Reemplaza el patrón
// `const [loading, setLoading] = useState(false); try { setLoading(true);
// await axios(...); } catch(e) { setError(...); } finally { setLoading(false); }`
// que aparece en 20+ componentes.
//
// Uso:
//   const { execute, loading, error, data, reset } = useApi(async (id) => {
//     const { data } = await axios.delete(`/api/things/${id}`);
//     return data;
//   });
//   const handleClick = () => execute(thing._id);
//
// Notas:
//   - `error` siempre es un string listo para mostrar (usa getErrorMessage).
//   - `execute` re-tira el error original para que el caller pueda hacer
//     navegación condicional, optimistic rollback, etc.
//   - Si el componente desmonta antes de que la promesa resuelva, los
//     setStates internos se ignoran — evita el warning "setState on
//     unmounted component" sin que el caller tenga que cancelar a mano.

export function useApi(fn, options = {}) {
  const { defaultErrorMessage = "Algo salió mal" } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (...args) => {
      setLoading(true);
      setError("");
      try {
        const result = await fn(...args);
        if (mountedRef.current) setData(result);
        return result;
      } catch (err) {
        if (mountedRef.current) {
          setError(getErrorMessage(err, defaultErrorMessage));
        }
        throw err;
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [fn, defaultErrorMessage],
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError("");
    setData(null);
  }, []);

  return { loading, error, data, execute, reset };
}

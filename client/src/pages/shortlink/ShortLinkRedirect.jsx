import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "../../api/endpoints";
import NotFound from "../error/NotFound";

// Resuelve `/s/:code` y navega al recurso canónico. En producción el middleware
// de Vercel ya redirige (humano) o sirve OG (crawler) ANTES de llegar acá; esta
// ruta cubre el dev server (Vite no corre el middleware) y es el fallback si el
// middleware falla. Pública: cualquier visitante (anónimo incluido) resuelve.
export default function ShortLinkRedirect() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    axios
      .get(API.shortlinks.RESOLVE(code), { signal: ac.signal })
      .then(({ data }) => {
        if (ac.signal.aborted) return;
        if (data?.path) navigate(data.path, { replace: true });
        else setNotFound(true);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setNotFound(true);
      });
    return () => ac.abort();
  }, [code, navigate]);

  return notFound ? <NotFound /> : null;
}

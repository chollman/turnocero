import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { API } from "../../api/endpoints";
import BackButton from "../../components/shared/BackButton";
import NoticiaForm from "./NoticiaForm";
import styles from "./NoticiaForm.module.css";

export default function EditNoticia() {
  const { id } = useParams();
  const [noticia, setNoticia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    axios
      .get(API.noticias.DETAIL(id), { signal: ac.signal })
      .then(({ data }) => {
        if (!ac.signal.aborted) setNoticia(data);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setNotFound(true);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [id]);

  if (loading)
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <div className={styles.loadingNote}>Cargando…</div>
        </div>
      </div>
    );

  if (notFound || !noticia)
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <p className={styles.loadingNote}>Noticia no encontrada</p>
          <BackButton to="/noticias" flush>
            Volver al noticiero
          </BackButton>
        </div>
      </div>
    );

  return <NoticiaForm mode="edit" initial={noticia} id={id} />;
}

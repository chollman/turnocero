import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Modal from "./Modal";
import Avatar from "./Avatar";
import { getUserDisplay } from "../../utils/userDisplay";
import styles from "./LikersModal.module.css";

// Modal "¿a quién le gustó?". Hace fetch de `fetchUrl` al abrir (el endpoint
// devuelve `{ users: [...] }` con users poblados, más reciente primero) y
// lista Avatar + nombre, cada uno linkeado a su perfil público. Reusable para
// likes de post y de comentarios (compartidas y mesas).
//
// Props:
//  - isOpen, onClose
//  - title:    string   — encabezado del modal
//  - fetchUrl: string   — endpoint de likers (se refetchea cada vez que abre)
export default function LikersModal({ isOpen, onClose, title, fetchUrl }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isOpen || !fetchUrl) return undefined;
    const ac = new AbortController();
    setLoading(true);
    setError(false);
    axios
      .get(fetchUrl, { signal: ac.signal })
      .then(({ data }) => setUsers(data.users || []))
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setError(true);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [isOpen, fetchUrl]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={title || "A quién le gustó"}
      className={styles.modal}
      backdropClassName={styles.backdrop}
    >
      <div className={styles.head}>
        <h3 className={styles.title}>{title || "A quién le gustó"}</h3>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>

      <div className={styles.body}>
        {loading ? (
          <ul className={styles.list} aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className={styles.skeletonRow}>
                <span className={styles.skeletonAvatar} />
                <span className={styles.skeletonName} />
              </li>
            ))}
          </ul>
        ) : error ? (
          <p className={styles.empty}>No pudimos cargar la lista.</p>
        ) : users.length === 0 ? (
          <p className={styles.empty}>Todavía no le gustó a nadie.</p>
        ) : (
          <ul className={styles.list}>
            {users.map((u, idx) => {
              const info = getUserDisplay(u);
              const to =
                !info.isDeleted && info._id ? `/usuarios/${info._id}` : null;
              const row = (
                <>
                  <Avatar user={u} size="sm" />
                  <span className={styles.name}>{info.name}</span>
                </>
              );
              return (
                <li key={info._id || `liker-${idx}`} className={styles.row}>
                  {to ? (
                    <Link to={to} className={styles.rowLink} onClick={onClose}>
                      {row}
                    </Link>
                  ) : (
                    <span className={styles.rowLink}>{row}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}

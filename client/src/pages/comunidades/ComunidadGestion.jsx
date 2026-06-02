import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { API } from "../../api/endpoints";
import { useAuth } from "../../context/AuthContext";
import { useCommunity } from "../../context/CommunityContext";
import { useNotifications } from "../../context/NotificationContext";
import Avatar from "../../components/shared/Avatar";
import Meeple from "../../components/shared/Meeple";
import styles from "./ComunidadGestion.module.css";

// Página de gestión para subadmins de una comunidad (o admin global):
// revisar solicitudes de unión (aceptar/rechazar) + miembros (expulsar).
// La moderación de contenido se hace desde los botones de borrar del propio
// contenido (el backend ya habilita a los subadmins vía canModerate).
export default function ComunidadGestion() {
  const { slug } = useParams();
  const { user } = useAuth();
  const { memberships } = useCommunity();
  const { addToast } = useNotifications();
  const [tab, setTab] = useState("solicitudes");
  const [solicitudes, setSolicitudes] = useState([]);
  const [miembros, setMiembros] = useState([]);
  const [loading, setLoading] = useState(true);

  const isSubadmin =
    !!user?.isAdmin ||
    memberships.some(
      (m) => m.community.slug === slug && m.role === "subadmin",
    );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sol, mem] = await Promise.all([
        axios.get(API.comunidades.SOLICITUDES(slug)),
        axios.get(API.comunidades.MIEMBROS(slug)),
      ]);
      setSolicitudes(sol.data.solicitudes || []);
      setMiembros(mem.data.miembros || []);
    } catch (err) {
      addToast({
        type: "error",
        message: err.response?.data?.message || "No se pudo cargar la gestión",
      });
    } finally {
      setLoading(false);
    }
  }, [slug, addToast]);

  useEffect(() => {
    if (isSubadmin) load();
  }, [load, isSubadmin]);

  if (!isSubadmin) {
    return (
      <div className={styles.page}>
        <p className={styles.muted}>
          No tenés permisos para gestionar esta comunidad.
        </p>
      </div>
    );
  }

  const act = async (fn, msg) => {
    try {
      await fn();
      addToast({ type: "success", message: msg });
      await load();
    } catch (err) {
      addToast({
        type: "error",
        message: err.response?.data?.message || "No se pudo completar",
      });
    }
  };

  const uid = (s) => s.user?._id || s.user;
  const accept = (userId) =>
    act(
      () => axios.post(API.comunidades.SOLICITUD_ACCEPT(slug, userId)),
      "Solicitud aceptada",
    );
  const reject = (userId) =>
    act(
      () => axios.post(API.comunidades.SOLICITUD_REJECT(slug, userId)),
      "Solicitud rechazada",
    );
  const expel = (userId) =>
    act(
      () => axios.delete(API.comunidades.MIEMBRO(slug, userId)),
      "Miembro expulsado",
    );

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.eyebrow}>
          <Meeple /> GESTIÓN
        </div>
        <h1 className={styles.title}>Gestionar comunidad</h1>
      </header>

      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "solicitudes"}
          className={`${styles.tab} ${tab === "solicitudes" ? styles.tabActive : ""}`}
          onClick={() => setTab("solicitudes")}
        >
          Solicitudes ({solicitudes.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "miembros"}
          className={`${styles.tab} ${tab === "miembros" ? styles.tabActive : ""}`}
          onClick={() => setTab("miembros")}
        >
          Miembros ({miembros.length})
        </button>
      </div>

      {loading ? (
        <p className={styles.muted}>Cargando…</p>
      ) : tab === "solicitudes" ? (
        solicitudes.length === 0 ? (
          <p className={styles.muted}>Sin solicitudes pendientes.</p>
        ) : (
          <ul className={styles.list}>
            {solicitudes.map((s) => (
              <li key={uid(s)} className={styles.row}>
                <Avatar user={s.user} size="sm" />
                <span className={styles.name}>
                  {s.user?.displayName || s.user?.username || "Usuario"}
                </span>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.accept}
                    onClick={() => accept(uid(s))}
                  >
                    Aceptar
                  </button>
                  <button
                    type="button"
                    className={styles.reject}
                    onClick={() => reject(uid(s))}
                  >
                    Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : (
        <ul className={styles.list}>
          {miembros.map((m) => (
            <li key={m._id} className={styles.row}>
              <Avatar user={m} size="sm" />
              <span className={styles.name}>{m.displayName || m.username}</span>
              {m.role === "subadmin" && (
                <span className={styles.roleTag}>Subadmin</span>
              )}
              {String(m._id) !== String(user._id) && (
                <button
                  type="button"
                  className={styles.reject}
                  onClick={() => expel(m._id)}
                >
                  Expulsar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

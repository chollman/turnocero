import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useCommunity } from "../../context/CommunityContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { useNotifications } from "../../context/NotificationContext";
import Meeple from "../shared/Meeple";
import styles from "./CommunitySwitcher.module.css";

// Selector de comunidad en el shell (Sidebar — que en mobile es el drawer).
// Atajo visible para: cambiar el aspecto (skin) del sitio, elegir qué
// comunidades ver en conjunto (viewing) y saltar a "Mis Comunidades".
// Reemplaza el descubrimiento enterrado en /perfil (CommunityPrefs sigue ahí).
export default function CommunitySwitcher({ onNavigate }) {
  const {
    memberships = [],
    viewing = [],
    skin,
    skinCommunity,
    setViewingPref,
    setSkinPref,
    loaded,
  } = useCommunity();
  const { isSectionEnabled } = useSiteConfig();
  const { addToast } = useNotifications();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  // Cerrar al clickear afuera o con Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Feature apagada, contexto sin cargar o usuario sin comunidades → nada.
  if (!isSectionEnabled("comunidades")) return null;
  if (!loaded || memberships.length === 0) return null;

  const hasMultiple = memberships.length > 1;
  const activeName = skinCommunity?.name || "TurnoCero";
  // viewing vacío = todas tildadas (espeja la lógica del server/CommunityPrefs).
  const viewingSet = new Set(
    viewing.length ? viewing : memberships.map((m) => String(m.community._id)),
  );

  const guard = async (fn, errMsg) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      addToast?.({
        type: "error",
        message: err?.response?.data?.message || errMsg,
      });
    } finally {
      setBusy(false);
    }
  };

  const toggleViewing = (id) => {
    const next = new Set(viewingSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return guard(
      () => setViewingPref([...next]),
      "No pudimos guardar tus preferencias",
    );
  };

  const chooseSkin = (id) =>
    guard(() => setSkinPref(id), "No pudimos cambiar el aspecto");

  const closeAndNavigate = () => {
    setOpen(false);
    onNavigate?.();
  };

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Cambiar de comunidad"
      >
        <span className={styles.eyebrow}>
          <Meeple /> COMUNIDAD
        </span>
        <span className={styles.activeName}>{activeName}</span>
        <svg
          className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className={styles.panel} role="menu">
          {hasMultiple ? (
            <>
              <p className={styles.help}>
                Tildá las que querés ver en conjunto y elegí cuál define el
                aspecto del sitio.
              </p>
              <ul className={styles.list}>
                {memberships.map((m) => {
                  const id = String(m.community._id);
                  const isSkin = String(skin) === id;
                  return (
                    <li key={id} className={styles.row}>
                      <label className={styles.viewing}>
                        <input
                          type="checkbox"
                          checked={viewingSet.has(id)}
                          disabled={busy}
                          onChange={() => toggleViewing(id)}
                        />
                        <span className={styles.cname}>{m.community.name}</span>
                      </label>
                      <button
                        type="button"
                        className={`${styles.skinBtn} ${isSkin ? styles.skinBtnActive : ""}`}
                        disabled={busy || isSkin}
                        onClick={() => chooseSkin(id)}
                        title={
                          isSkin
                            ? "Esta comunidad define el aspecto"
                            : "Usar el aspecto de esta comunidad"
                        }
                      >
                        {isSkin ? "Aspecto activo" : "Usar aspecto"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className={styles.help}>
              Por ahora solo estás en TurnoCero. Descubrí y unite a otras
              comunidades para ver su contenido y su aspecto.
            </p>
          )}
          <Link
            to="/comunidades"
            className={styles.allLink}
            onClick={closeAndNavigate}
            role="menuitem"
          >
            Ver todas las comunidades →
          </Link>
        </div>
      )}
    </div>
  );
}

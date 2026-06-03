import { useState } from "react";
import { Link } from "react-router-dom";
import { useCommunity } from "../../context/CommunityContext";
import { useNotifications } from "../../context/NotificationContext";
import useViewingControls from "../../hooks/useViewingControls";
import ConfirmActionModal from "../../components/shared/ConfirmActionModal";
import styles from "./CommunityPrefs.module.css";

// Sección "Comunidades" del perfil: elegir qué comunidades ver en conjunto
// (viewing) + cuál aplica su skin, y salir de comunidades.
export default function CommunityPrefs() {
  const { memberships, skin, leaveCommunity } = useCommunity();
  const { addToast } = useNotifications();
  const { busy, viewingSet, toggleViewing, chooseSkin, guard } =
    useViewingControls();
  // Membership pendiente de confirmación de salida (abre el modal).
  const [leaveTarget, setLeaveTarget] = useState(null);

  // Una sola membership (la base) → no hay nada que elegir todavía.
  if (memberships.length <= 1) return null;

  const confirmLeave = () =>
    guard(async () => {
      const m = leaveTarget;
      await leaveCommunity(m.community.slug);
      addToast({ type: "success", message: `Saliste de ${m.community.name}` });
      setLeaveTarget(null);
    }, "No pudimos salir de la comunidad");

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Comunidades</h2>
      <p className={styles.help}>
        Elegí qué comunidades ver en conjunto y cuál usar para el aspecto del
        sitio.
      </p>
      <ul className={styles.list}>
        {memberships.map((m) => {
          const id = String(m.community._id);
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
                {m.role === "subadmin" && (
                  <span className={styles.roleTag}>Subadmin</span>
                )}
              </label>
              <label className={styles.skin}>
                <input
                  type="radio"
                  name="skinCommunity"
                  checked={String(skin) === id}
                  disabled={busy}
                  onChange={() => chooseSkin(id)}
                />
                Skin
              </label>
              {m.role === "subadmin" && (
                <Link
                  className={styles.manage}
                  to={`/comunidades/${m.community.slug}/gestion`}
                >
                  Gestionar
                </Link>
              )}
              {!m.community.isBase && (
                <button
                  type="button"
                  className={styles.leave}
                  disabled={busy}
                  onClick={() => setLeaveTarget(m)}
                >
                  Salir
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className={styles.note}>
        Si no marcás ninguna en "ver juntas", ves todas.
      </p>

      <ConfirmActionModal
        isOpen={!!leaveTarget}
        title="Salir de la comunidad"
        message={`¿Querés salir de ${leaveTarget?.community?.name}? Vas a dejar de ver su contenido. Podés volver a unirte cuando quieras.`}
        confirmLabel="Sí, salir"
        variant="danger"
        loading={busy}
        onConfirm={confirmLeave}
        onCancel={() => {
          if (!busy) setLeaveTarget(null);
        }}
      />
    </section>
  );
}

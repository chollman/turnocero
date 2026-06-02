import { useState } from "react";
import { useCommunity } from "../../context/CommunityContext";
import { useNotifications } from "../../context/NotificationContext";
import styles from "./CommunityPrefs.module.css";

// Sección "Comunidades" del perfil: elegir qué comunidades ver en conjunto
// (viewing) + cuál aplica su skin, y salir de comunidades.
export default function CommunityPrefs() {
  const {
    memberships,
    viewing,
    skin,
    setViewingPref,
    setSkinPref,
    leaveCommunity,
  } = useCommunity();
  const { addToast } = useNotifications();
  const [busy, setBusy] = useState(false);

  // Una sola membership (la base) → no hay nada que elegir todavía.
  if (memberships.length <= 1) return null;

  // viewing vacío = todas. En la UI, mostrar "todas" tildadas en ese caso.
  const viewingSet = new Set(
    viewing.length ? viewing : memberships.map((m) => String(m.community._id)),
  );

  const guard = async (fn, errMsg) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      addToast({ type: "error", message: err?.response?.data?.message || errMsg });
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
    guard(() => setSkinPref(id), "No pudimos cambiar el skin");

  const handleLeave = (m) =>
    guard(async () => {
      await leaveCommunity(m.community.slug);
      addToast({ type: "success", message: `Saliste de ${m.community.name}` });
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
              {!m.community.isBase && (
                <button
                  type="button"
                  className={styles.leave}
                  disabled={busy}
                  onClick={() => handleLeave(m)}
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
    </section>
  );
}

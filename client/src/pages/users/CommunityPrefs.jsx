import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCommunity } from "../../context/CommunityContext";
import { useNotifications } from "../../context/NotificationContext";
import useViewingControls from "../../hooks/useViewingControls";
import ConfirmActionModal from "../../components/shared/ConfirmActionModal";
import styles from "./CommunityPrefs.module.css";

// Sección "Comunidades" del perfil: elegir qué comunidades ver en conjunto
// (viewing) + cuál aplica su skin, y salir de comunidades.
//
// `embed`: cuando es true, se renderiza SIN el `<section>`/heading propios —
// el caller (UserProfile) ya lo envuelve en una card numerada con su header.
export default function CommunityPrefs({ embed = false }) {
  const { t } = useTranslation();
  const { memberships, skin, leaveCommunity } = useCommunity();
  const { addToast } = useNotifications();
  const { busy, viewingSet, toggleViewing, chooseSkin, guard } =
    useViewingControls();
  // Membership pendiente de confirmación de salida (abre el modal).
  const [leaveTarget, setLeaveTarget] = useState(null);

  // Una sola membership (la base) → no hay nada que elegir todavía.
  if (memberships.length <= 1) {
    if (embed) {
      return (
        <p className={styles.help} style={{ margin: 0 }}>
          {t("usuarios:communityPrefs.soloBase")}
        </p>
      );
    }
    return null;
  }

  const confirmLeave = () =>
    guard(async () => {
      const m = leaveTarget;
      await leaveCommunity(m.community.slug);
      addToast({
        type: "success",
        message: t("usuarios:communityPrefs.leftCommunity", {
          name: m.community.name,
        }),
      });
      setLeaveTarget(null);
    }, t("usuarios:communityPrefs.leaveError"));

  const inner = (
    <>
      <p className={styles.help} style={embed ? { marginTop: 0 } : undefined}>
        {t("usuarios:communityPrefs.help")}
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
                  <span className={styles.roleTag}>
                    {t("usuarios:communityPrefs.subadmin")}
                  </span>
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
                {t("usuarios:communityPrefs.skin")}
              </label>
              {m.role === "subadmin" && (
                <Link
                  className={styles.manage}
                  to={`/comunidades/${m.community.slug}/gestion`}
                >
                  {t("usuarios:communityPrefs.manage")}
                </Link>
              )}
              {!m.community.isBase && (
                <button
                  type="button"
                  className={styles.leave}
                  disabled={busy}
                  onClick={() => setLeaveTarget(m)}
                >
                  {t("usuarios:communityPrefs.leave")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className={styles.note}>{t("usuarios:communityPrefs.note")}</p>

      <ConfirmActionModal
        isOpen={!!leaveTarget}
        title={t("usuarios:communityPrefs.leaveTitle")}
        message={t("usuarios:communityPrefs.leaveMessage", {
          name: leaveTarget?.community?.name,
        })}
        confirmLabel={t("usuarios:communityPrefs.leaveConfirm")}
        variant="danger"
        loading={busy}
        onConfirm={confirmLeave}
        onCancel={() => {
          if (!busy) setLeaveTarget(null);
        }}
      />
    </>
  );

  if (embed) return inner;

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{t("usuarios:communityPrefs.heading")}</h2>
      {inner}
    </section>
  );
}

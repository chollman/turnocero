import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import Avatar from "../../components/shared/Avatar";
import Modal from "../../components/shared/Modal";
import NotifIcon from "./NotifIcons";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { API } from "../../api/endpoints";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { snapshotToInitialValues } from "../bg-watch/playSnapshot";
import { formatTimeAgo } from "../../utils/time";
import styles from "./SharedPlayNotifCard.module.css";

// Tarjeta rica para `bgg_play_shared`: muestra el detalle amigable de la
// partida que un co-jugador cargó (juego, jugadores con scores, fecha — la
// ubicación NO se comparte) y dos acciones — "cargar como aparece" (con
// confirmación) y "cargar
// con correcciones" (lleva al PlayForm precargado). Si el destinatario no tiene
// BGG conectado, ofrece conectar en vez de los botones de carga.
export default function SharedPlayNotifCard({ notif }) {
  const { user } = useAuth();
  const { dismiss, markSharedPlayLoaded, addToast } = useNotifications();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const notifId = notif.notifId || notif._id;
  const snap = notif.playSnapshot || {};
  const players = Array.isArray(snap.players) ? snap.players : [];
  const author = { _id: notif.fromUserId, username: notif.fromUsername };
  const connected = !!user?.bggConnected && !user?.bggInvalid;
  const image = snap.gameImage || snap.gameThumbnail || null;

  const handleDismiss = () => dismiss(notifId);

  const handleLoadAsIs = async () => {
    setSubmitting(true);
    try {
      await axios.post(API.bgg.PARTIDA_COMPARTIDA(notifId));
      addToast({ type: "success", message: "¡Partida cargada en BGG!" });
      // No se descarta: el server la marcó como leída + cargada. La tarjeta
      // pierde los botones y queda como una notif común hasta que la limpien.
      markSharedPlayLoaded(notifId);
      setConfirmOpen(false);
      setSubmitting(false);
    } catch (err) {
      addToast({
        type: "error",
        message: getErrorMessage(err, "No se pudo cargar la partida."),
      });
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const handleCorrections = () => {
    navigate(
      `/bg-watch/${encodeURIComponent(user.bggUsername)}/partidas/nueva`,
      {
        state: {
          prefill: snapshotToInitialValues(snap),
          sharedFromNotifId: notifId,
        },
      },
    );
  };

  // La ubicación no se incluye en la notif: es un dato privado de quien cargó
  // la partida.
  const meta = [
    snap.date,
    snap.duration ? `${snap.duration} min` : null,
  ].filter(Boolean);

  return (
    <li className={`${styles.card} ${!notif.read ? styles.unread : ""}`}>
      <header className={styles.head}>
        <Avatar user={author} size="sm" />
        <div className={styles.headText}>
          <span className={styles.title}>
            <strong>{notif.fromUsername || "Alguien"}</strong> te incluyó en una
            partida
          </span>
          <span className={styles.time}>
            {formatTimeAgo(notif.updatedAt || notif.timestamp)}
          </span>
        </div>
        <button
          type="button"
          className={styles.dismiss}
          onClick={handleDismiss}
          aria-label="Descartar"
          title="Descartar"
        >
          <NotifIcon name="X" size={14} />
        </button>
      </header>

      <div className={styles.game}>
        {image ? (
          <img
            className={styles.cover}
            src={image}
            alt={snap.gameName || "Juego"}
            loading="lazy"
          />
        ) : (
          <span className={styles.coverFallback}>
            <NotifIcon name="Dice" size={22} />
          </span>
        )}
        <div className={styles.gameInfo}>
          <span className={styles.gameName}>{snap.gameName || "Partida"}</span>
          {meta.length > 0 && (
            <span className={styles.gameMeta}>{meta.join(" · ")}</span>
          )}
        </div>
      </div>

      {players.length > 0 && (
        <ul className={styles.players}>
          {players.map((p, i) => (
            <li
              key={`${p.username || p.name || "j"}-${i}`}
              className={`${styles.player} ${p.win ? styles.winner : ""}`}
            >
              <span className={styles.pName}>
                {p.win && (
                  <span className={styles.crown} aria-hidden>
                    🏆
                  </span>
                )}
                {p.name || p.username || "Jugador"}
              </span>
              {p.score != null && p.score !== "" && (
                <span className={styles.pScore}>{p.score}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {notif.playLoaded ? (
        <div className={styles.loadedStatus}>
          <NotifIcon name="Check" size={15} />
          Cargaste esta partida en tu cuenta de BGG
        </div>
      ) : connected ? (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.loadBtn}
            onClick={() => setConfirmOpen(true)}
          >
            Cargar esta partida como aparece
          </button>
          <button
            type="button"
            className={styles.fixBtn}
            onClick={handleCorrections}
          >
            Cargar con correcciones
          </button>
        </div>
      ) : (
        <div className={styles.actions}>
          <Link to="/perfil" className={styles.connectBtn}>
            Conectá tu cuenta de BGG para cargarla
          </Link>
        </div>
      )}

      <Modal
        isOpen={confirmOpen}
        onClose={() => !submitting && setConfirmOpen(false)}
        ariaLabel="Confirmar carga de partida"
        backdropClassName={styles.backdrop}
        className={styles.confirm}
        dismissOnBackdrop={!submitting}
      >
        <h3 className={styles.confirmTitle}>¿Cargar esta partida?</h3>
        <p className={styles.confirmText}>
          Se va a registrar <strong>{snap.gameName || "la partida"}</strong> en
          tu cuenta de BGG con {players.length}{" "}
          {players.length === 1 ? "jugador" : "jugadores"}, tal como aparece.
        </p>
        <div className={styles.confirmActions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => setConfirmOpen(false)}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.loadBtn}
            onClick={handleLoadAsIs}
            disabled={submitting}
          >
            {submitting ? "Cargando…" : "Sí, cargar"}
          </button>
        </div>
      </Modal>
    </li>
  );
}

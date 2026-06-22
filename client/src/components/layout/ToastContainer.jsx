import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useNotifications } from "../../context/NotificationContext";
import { useChat } from "../../context/ChatContext";
import styles from "./ToastContainer.module.css";

const DESKTOP = 960;

const DURATION = {
  chat: 4000,
  join_request: 4000,
  join_accepted: 5500,
  player_joined: 5000,
  player_left: 5000,
  spot_opened: 6000,
  comment: 4000,
  image: 4000,
  friend_request: 6000,
  friend_accepted: 5500,
  dm: 4000,
  dm_new: 7000,
  tournament_accepted: 6000,
  tournament_rejected: 6000,
  tournament_advanced: 6000,
  tournament_eliminated: 6000,
  tournament_pending: 5000,
  tournament_started: 6000,
  tournament_finished: 6000,
  compartida_comment: 4000,
  compartida_like: 4000,
  table_cancelled: 6000,
  join_rejected: 5500,
  noticia: 6000,
  bgwatch_connected: 7000,
  evento_confirmed: 6000,
  evento_rejected: 6000,
  evento_cancelled: 6000,
  evento_updated: 5500,
  evento_reminder: 7000,
  community_join_request: 6000,
  community_join_accepted: 6000,
  community_join_rejected: 5500,
  bgg_play_shared: 7000,
  bgg_play_accepted: 6000,
  // Toasts disparados manualmente desde el client (sin backend event).
  error: 5000,
  success: 5000,
};

// Construye el título del toast a partir de su `type`. Pura (recibe `t`) para
// poder testearla aislada. Los campos que son puro dato (sin texto alrededor)
// se devuelven crudos, sin pasar por i18n.
export function getToastTitle(toast, t) {
  switch (toast.type) {
    case "bgg_play_shared":
      return t("toasts:title.bggShared", {
        username: toast.fromUsername || t("toasts:words.someoneCap"),
      });
    case "bgg_play_accepted":
      return t("toasts:title.bggAccepted", {
        username: toast.fromUsername || t("toasts:words.someoneCap"),
      });
    case "join_accepted":
      return t("toasts:title.joinAccepted");
    case "player_joined":
      return t("toasts:title.playerJoined");
    case "player_left":
      return t("toasts:title.playerLeft");
    case "spot_opened":
      return t("toasts:title.spotOpened");
    case "friend_request":
    case "friend_accepted":
    case "dm_new":
    case "dm":
      return `${toast.fromUsername}`;
    case "tournament_accepted":
      return t("toasts:title.tournamentAccepted");
    case "tournament_rejected":
      return t("toasts:title.tournamentRejected");
    case "tournament_advanced":
      return toast.isPhase
        ? t("toasts:title.tournamentAdvancedPhase")
        : t("toasts:title.tournamentAdvancedRound");
    case "tournament_eliminated":
      return t("toasts:title.tournamentEliminated");
    case "tournament_pending":
      return t("toasts:title.tournamentPending");
    case "tournament_started":
      return t("toasts:title.tournamentStarted");
    case "tournament_finished":
      return t("toasts:title.tournamentFinished");
    case "compartida_comment":
      return `${toast.commenterUsername}`;
    case "compartida_like":
      return `${toast.fromUsername}`;
    case "table_cancelled":
      return t("toasts:title.tableCancelled");
    case "join_rejected":
      return t("toasts:title.joinRejected");
    case "noticia":
      return t("toasts:title.noticia");
    case "bgwatch_connected":
      return t("toasts:title.bgwatchConnected");
    case "evento_confirmed":
      return t("toasts:title.eventoConfirmed");
    case "evento_rejected":
      return toast.permanentlyRejected
        ? t("toasts:title.eventoRejectedPermanent")
        : t("toasts:title.eventoRejected");
    case "evento_cancelled":
      return toast.eventoDeleted
        ? t("toasts:title.eventoCancelledDeleted")
        : t("toasts:title.eventoCancelled");
    case "evento_updated":
      return t("toasts:title.eventoUpdated");
    case "evento_reminder":
      return t("toasts:title.eventoReminder");
    case "evento_ludoteca_added":
      return t("toasts:title.ludotecaAdded");
    case "evento_mesa_created":
      return t("toasts:title.mesaCreated");
    case "community_join_request":
      return toast.communityName || t("toasts:title.communityFallback");
    case "community_join_accepted":
      return t("toasts:title.communityJoinAccepted");
    case "community_join_rejected":
      return t("toasts:title.communityJoinRejected");
    case "error":
      return toast.title || t("toasts:title.errorFallback");
    case "success":
      return toast.title || t("toasts:title.successFallback");
    default:
      return toast.tableName;
  }
}

// Construye el cuerpo del toast. Pura (recibe `t`). La lógica JS (truncado de
// preview, mapeo de changedFields, comillas curvas del nombre del juego) se
// mantiene en JS; sólo los literales con texto pasan por i18n.
export function getToastBody(toast, t) {
  switch (toast.type) {
    case "bgg_play_shared":
      return t("toasts:body.bggShared", {
        game: toast.gameName
          ? `“${toast.gameName}”`
          : t("toasts:words.aPlay"),
      });
    case "bgg_play_accepted":
      return t("toasts:body.bggAccepted");
    case "chat":
      return t("toasts:body.chat", {
        sender: toast.senderUsername,
        preview: `${toast.messagePreview}${toast.messagePreview?.length >= 60 ? "…" : ""}`,
      });
    case "join_request":
      return t("toasts:body.joinRequest", {
        requester: toast.requesterUsername,
      });
    case "player_joined":
      return t("toasts:body.playerJoined", {
        joiner: toast.joinerUsername,
        table: toast.tableName,
      });
    case "player_left":
      return t("toasts:body.playerLeft", {
        leaver: toast.leaverUsername,
        table: toast.tableName,
      });
    case "spot_opened":
      return t("toasts:body.spotOpened", { table: toast.tableName });
    case "comment":
      return t("toasts:body.comment", {
        commenter: toast.commenterUsername,
        preview: `${toast.commentPreview}${toast.commentPreview?.length >= 60 ? "…" : ""}`,
      });
    case "image":
      return t("toasts:body.image", { uploader: toast.uploaderUsername });
    case "friend_request":
      return t("toasts:body.friendRequest");
    case "friend_accepted":
      return t("toasts:body.friendAccepted");
    case "dm_new":
      return t("toasts:body.dmNew");
    case "dm":
      return `${toast.messagePreview}${toast.messagePreview?.length >= 60 ? "…" : ""}`;
    case "tournament_accepted":
      return t("toasts:body.tournamentAccepted", { torneo: toast.torneoTitle });
    case "tournament_rejected":
      return `${toast.torneoTitle}`;
    case "tournament_advanced":
      return t("toasts:body.tournamentAdvanced", { torneo: toast.torneoTitle });
    case "tournament_eliminated":
      return t("toasts:body.tournamentEliminated", {
        torneo: toast.torneoTitle,
      });
    case "tournament_pending":
      return t("toasts:body.tournamentPending", { torneo: toast.torneoTitle });
    case "tournament_started":
      return t("toasts:body.tournamentStarted", { torneo: toast.torneoTitle });
    case "tournament_finished":
      return t("toasts:body.tournamentFinished", { torneo: toast.torneoTitle });
    case "compartida_comment":
      return `${toast.commentPreview ?? ""}${toast.commentPreview?.length >= 60 ? "…" : ""}`;
    case "compartida_like":
      return t("toasts:body.compartidaLike");
    case "table_cancelled":
      return t("toasts:body.tableCancelled", { table: toast.tableName });
    case "join_rejected":
      return t("toasts:body.joinRejected", { table: toast.tableName });
    case "noticia":
      return toast.title;
    case "bgwatch_connected":
      return t("toasts:body.bgwatchConnected");
    case "evento_confirmed":
      return t("toasts:body.eventoConfirmed", { evento: toast.eventoTitle });
    case "evento_rejected":
      return toast.permanentlyRejected
        ? t("toasts:body.eventoRejectedPermanent", { evento: toast.eventoTitle })
        : `${toast.eventoTitle}`;
    case "evento_cancelled":
      return toast.eventoDeleted
        ? t("toasts:body.eventoCancelledDeleted", { evento: toast.eventoTitle })
        : t("toasts:body.eventoCancelled", { evento: toast.eventoTitle });
    case "evento_updated": {
      const fields = Array.isArray(toast.changedFields)
        ? toast.changedFields
        : [];
      const labels = fields.map((f) =>
        f === "eventDate"
          ? t("toasts:words.fieldDate")
          : f === "location"
            ? t("toasts:words.fieldLocation")
            : f,
      );
      const detail = labels.length
        ? labels.join(" + ")
        : t("toasts:words.changesFallback");
      return t("toasts:body.eventoUpdated", {
        evento: toast.eventoTitle,
        detail,
      });
    }
    case "evento_reminder":
      return t("toasts:body.eventoReminder", { evento: toast.eventoTitle });
    case "evento_ludoteca_added": {
      const who = toast.addedByUsername || t("toasts:words.someone");
      const game = toast.gameName
        ? `“${toast.gameName}”`
        : t("toasts:words.aGame");
      return t("toasts:body.ludotecaAdded", {
        who,
        game,
        evento: toast.eventoTitle,
      });
    }
    case "evento_mesa_created": {
      const who = toast.hostUsername || t("toasts:words.someone");
      const game = toast.gameName
        ? `“${toast.gameName}”`
        : t("toasts:words.aPlay");
      return t("toasts:body.mesaCreated", {
        who,
        game,
        evento: toast.eventoTitle,
      });
    }
    case "community_join_request":
      return t("toasts:body.communityJoinRequest", {
        requester: toast.requesterUsername,
      });
    case "community_join_accepted":
      return t("toasts:body.communityJoinAccepted", {
        community: toast.communityName || t("toasts:words.theCommunity"),
      });
    case "community_join_rejected":
      return t("toasts:body.communityJoinRejected", {
        community: toast.communityName || t("toasts:words.theCommunity"),
      });
    case "error":
      return toast.message || "";
    case "success":
      return toast.message || "";
    default:
      return t("toasts:body.defaultJoin", { table: toast.tableName });
  }
}

function ToastItem({ toast, onDismiss }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { openChat, conversations } = useChat();
  const {
    markRead,
    markReadFriend,
    markReadTorneo,
    markReadCompartida,
    markReadEvento,
    markReadCommunity,
  } = useNotifications();
  const duration = DURATION[toast.type] ?? 4000;
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);
  const remainingRef = useRef(duration);
  // Initialized in the effect below; null until the first run.
  const startRef = useRef(null);

  useEffect(() => {
    if (paused) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        remainingRef.current -= Date.now() - (startRef.current ?? Date.now());
      }
      return;
    }
    startRef.current = Date.now();
    timerRef.current = setTimeout(
      () => onDismiss(toast.id),
      remainingRef.current,
    );
    return () => clearTimeout(timerRef.current);
  }, [paused, toast.id, onDismiss]);

  const handleClick = () => {
    if (toast.type === "friend_request" || toast.type === "friend_accepted") {
      markReadFriend(toast.fromUserId);
      navigate(`/usuarios/${toast.fromUserId}`);
    } else if (toast.type === "dm" || toast.type === "dm_new") {
      if (window.innerWidth >= DESKTOP) {
        const conv = conversations[toast.fromUserId];
        const contactUser = conv?.user || {
          _id: toast.fromUserId,
          username: toast.fromUsername,
        };
        openChat(contactUser);
      } else {
        navigate(`/mensajes/${toast.fromUserId}`);
      }
    } else if (toast.type?.startsWith("tournament_")) {
      markReadTorneo(toast.torneoId);
      navigate(`/torneos/${toast.torneoId}`);
    } else if (
      toast.type === "compartida_comment" ||
      toast.type === "compartida_like"
    ) {
      markReadCompartida(toast.compartidaId);
      navigate(`/compartidas/${toast.compartidaId}`);
    } else if (toast.type?.startsWith("evento_")) {
      markReadEvento(toast.eventoId);
      // Evento eliminado: /eventos/:id devolvería 404, mandamos a la lista.
      navigate(toast.eventoDeleted ? "/eventos" : `/eventos/${toast.eventoId}`);
    } else if (toast.type === "noticia") {
      navigate(`/noticias/${toast.noticiaId}`);
    } else if (toast.type?.startsWith("community_")) {
      markReadCommunity(toast.communityId);
      navigate(
        !toast.communitySlug
          ? "/comunidades"
          : toast.type === "community_join_request"
            ? `/comunidades/${toast.communitySlug}/gestion`
            : `/comunidades/${toast.communitySlug}`,
      );
    } else if (toast.type === "bgwatch_connected") {
      navigate(`/bg-watch/${encodeURIComponent(toast.bggUsername)}`);
    } else if (
      toast.type === "bgg_play_shared" ||
      toast.type === "bgg_play_accepted"
    ) {
      navigate("/notificaciones");
    } else if (toast.type === "error" || toast.type === "success") {
      // Toasts manuales del client: el click solo los descarta, no navega.
    } else {
      if (toast.tableId) markRead(toast.tableId);
      navigate(`/mesas/${toast.tableId}`);
    }
    onDismiss(toast.id);
  };

  const handleClose = (e) => {
    e.stopPropagation();
    onDismiss(toast.id);
  };

  const icon =
    toast.type === "bgg_play_shared"
      ? "🎲"
      : toast.type === "bgg_play_accepted"
        ? "🙏"
        : toast.type === "join_accepted"
      ? "✅"
      : toast.type === "join_request"
        ? "🔔"
        : toast.type === "player_joined"
          ? "🙌"
          : toast.type === "player_left"
            ? "🚪"
            : toast.type === "spot_opened"
              ? "🎯"
              : toast.type === "comment"
                ? "🗨️"
                : toast.type === "image"
                  ? "📸"
                  : toast.type === "friend_request"
                    ? "🤝"
                    : toast.type === "friend_accepted"
                      ? "✅"
                      : toast.type === "dm_new"
                        ? "💬"
                        : toast.type === "dm"
                          ? "💬"
                          : toast.type === "tournament_accepted"
                            ? "🏆"
                            : toast.type === "tournament_rejected"
                              ? "🚫"
                              : toast.type === "tournament_advanced"
                                ? "🎉"
                                : toast.type === "tournament_eliminated"
                                  ? "🥲"
                                  : toast.type === "tournament_pending"
                                    ? "⏳"
                                    : toast.type === "tournament_started"
                                      ? "🚀"
                                      : toast.type === "tournament_finished"
                                        ? "🏁"
                                        : toast.type === "compartida_comment"
                                          ? "🗨️"
                                          : toast.type === "compartida_like"
                                            ? "❤️"
                                            : toast.type === "table_cancelled"
                                              ? "❌"
                                              : toast.type === "join_rejected"
                                                ? "🚷"
                                                : toast.type === "noticia"
                                                  ? "📰"
                                                  : toast.type ===
                                                      "bgwatch_connected"
                                                    ? "🎲"
                                                    : toast.type ===
                                                        "evento_confirmed"
                                                      ? "🎉"
                                                      : toast.type ===
                                                          "evento_rejected"
                                                        ? toast.permanentlyRejected
                                                          ? "🚫"
                                                          : "🥲"
                                                        : toast.type ===
                                                            "evento_cancelled"
                                                          ? "❌"
                                                          : toast.type ===
                                                              "evento_updated"
                                                            ? "🔄"
                                                            : toast.type ===
                                                                "evento_reminder"
                                                              ? "🔔"
                                                              : toast.type ===
                                                                  "evento_ludoteca_added"
                                                                ? "🎲"
                                                                : toast.type ===
                                                                    "evento_mesa_created"
                                                                  ? "🎯"
                                                                  : toast.type ===
                                                                      "community_join_request"
                                                                    ? "🙋"
                                                                    : toast.type ===
                                                                        "community_join_accepted"
                                                                      ? "🎉"
                                                                      : toast.type ===
                                                                          "community_join_rejected"
                                                                        ? "🚫"
                                                                        : toast.type ===
                                                                            "error"
                                                                          ? "⚠️"
                                                                          : toast.type ===
                                                                              "success"
                                                                            ? "✅"
                                                                            : "🎲";

  const title = getToastTitle(toast, t);
  const body = getToastBody(toast, t);

  return (
    <div
      className={styles.toast}
      onClick={handleClick}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="alert"
    >
      <div className={styles.toastInner}>
        <span className={styles.icon}>{icon}</span>
        <div className={styles.text}>
          <span className={styles.title}>{title}</span>
          <span className={styles.body}>{body}</span>
        </div>
        <button
          className={styles.close}
          onClick={handleClose}
          aria-label={t("common:actions.close")}
        >
          ✕
        </button>
      </div>
      <div
        className={styles.progress}
        style={{
          animationDuration: `${duration}ms`,
          animationPlayState: paused ? "paused" : "running",
        }}
      />
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, dismissToast } = useNotifications();
  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
}

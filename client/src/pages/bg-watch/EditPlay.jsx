import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import {
  usePartidaQuery,
  updateBgWatchPlay,
  deleteBgWatchPlay,
} from "../../queries/bgWatch";
import { getErrorMessage } from "../../utils/getErrorMessage";
import PlayForm from "./PlayForm";

// Mapea una partida (de location.state o del endpoint) a initialValues del form.
function toInitialValues(play) {
  return {
    game: {
      id: play.gameId,
      name: play.gameName,
      thumbnail: play.gameThumbnail,
    },
    details: {
      playdate: play.date || "",
      length: play.duration != null ? String(play.duration) : "",
      location: play.location || "",
      quantity: play.quantity || 1,
      comments: play.comments || "",
      incomplete: !!play.incomplete,
      nowinstats: !!play.nowinstats,
    },
    players: Array.isArray(play.players) ? play.players : [],
  };
}

/**
 * Página de editar una partida
 * (`/bg-watch/:bggUsername/partidas/:playId/editar`). Usa `location.state.play`
 * (fast-path al venir de la lista) o lo trae del endpoint (refresh/deep-link).
 */
export default function EditPlay() {
  const { t } = useTranslation("bgwatch");
  const { bggUsername, playId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { addToast } = useNotifications();

  const [initialValues, setInitialValues] = useState(() => {
    const fromState = location.state?.play;
    return fromState ? toInitialValues(fromState) : null;
  });
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const isOwner =
    !!user?.bggUsername &&
    user.bggUsername.toLowerCase() === (bggUsername || "").toLowerCase();
  const canEdit = isOwner && user?.bggConnected && !user?.bggInvalid;

  useEffect(() => {
    if (!canEdit) navigate(`/bg-watch/${bggUsername}`, { replace: true });
  }, [canEdit, bggUsername, navigate]);

  // Fallback: si no vino la partida por state (refresh / deep-link), traerla.
  const { data: fetchedPlay, error: fetchError } = usePartidaQuery(
    bggUsername,
    playId,
    { enabled: canEdit && !initialValues },
  );
  useEffect(() => {
    if (fetchedPlay) setInitialValues(toInitialValues(fetchedPlay));
  }, [fetchedPlay]);
  const loadError = !!fetchError;

  const goBack = () => navigate(`/bg-watch/${bggUsername}`);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setServerError("");
    try {
      await updateBgWatchPlay(playId, payload);
      addToast({ type: "success", message: t("editPlay.playUpdated") });
      goBack();
    } catch (err) {
      const msg = getErrorMessage(err, t("editPlay.editError"));
      setServerError(msg);
      addToast({ type: "error", message: msg });
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t("editPlay.deleteConfirm"))) return;
    setSubmitting(true);
    try {
      await deleteBgWatchPlay(playId);
      addToast({ type: "success", message: t("editPlay.playDeleted") });
      goBack();
    } catch (err) {
      const msg = getErrorMessage(err, t("editPlay.deleteError"));
      setServerError(msg);
      addToast({ type: "error", message: msg });
      setSubmitting(false);
    }
  };

  if (!canEdit) return null;
  if (loadError) {
    return (
      <p style={{ padding: "2rem", textAlign: "center" }}>
        {t("editPlay.loadError")}
      </p>
    );
  }
  if (!initialValues) return null;

  return (
    <PlayForm
      user={user}
      initialValues={initialValues}
      editMode
      lockedGame
      submitting={submitting}
      serverError={serverError}
      onSubmit={handleSubmit}
      onCancel={goBack}
      onDelete={handleDelete}
    />
  );
}

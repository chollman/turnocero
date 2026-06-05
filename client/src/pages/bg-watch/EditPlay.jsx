import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { API } from "../../api/endpoints";
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
  const { bggUsername, playId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { addToast } = useNotifications();

  const [initialValues, setInitialValues] = useState(() => {
    const fromState = location.state?.play;
    return fromState ? toInitialValues(fromState) : null;
  });
  const [loadError, setLoadError] = useState(false);
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
  useEffect(() => {
    if (!canEdit || initialValues) return;
    const ac = new AbortController();
    axios
      .get(API.bgg.PARTIDA(bggUsername, playId), { signal: ac.signal })
      .then(({ data }) => setInitialValues(toInitialValues(data)))
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setLoadError(true);
      });
    return () => ac.abort();
  }, [canEdit, initialValues, bggUsername, playId]);

  const goBack = () => navigate(`/bg-watch/${bggUsername}`);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setServerError("");
    try {
      await axios.put(API.bgg.PARTIDA_DETAIL(playId), payload);
      addToast({ type: "success", message: "Partida actualizada." });
      goBack();
    } catch (err) {
      const msg = getErrorMessage(err, "No se pudo editar la partida.");
      setServerError(msg);
      addToast({ type: "error", message: msg });
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("¿Eliminar la partida? Se borra también en BGG."))
      return;
    setSubmitting(true);
    try {
      await axios.delete(API.bgg.PARTIDA_DETAIL(playId));
      addToast({ type: "success", message: "Partida eliminada." });
      goBack();
    } catch (err) {
      const msg = getErrorMessage(err, "No se pudo eliminar la partida.");
      setServerError(msg);
      addToast({ type: "error", message: msg });
      setSubmitting(false);
    }
  };

  if (!canEdit) return null;
  if (loadError) {
    return (
      <p style={{ padding: "2rem", textAlign: "center" }}>
        No se pudo cargar la partida.
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

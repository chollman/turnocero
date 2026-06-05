import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { API } from "../../api/endpoints";
import { getErrorMessage } from "../../utils/getErrorMessage";
import PlayForm from "./PlayForm";

/**
 * Página de cargar una partida (`/bg-watch/:bggUsername/partidas/nueva`).
 * Acepta `?juego=<gameId>` para prefijar el juego (desde la vista por-juego).
 * Solo el dueño con BGG conectado puede entrar; si no, redirige al perfil.
 */
export default function CreatePlay() {
  const { bggUsername } = useParams();
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get("juego") || null;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useNotifications();

  const [game, setGame] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const isOwner =
    !!user?.bggUsername &&
    user.bggUsername.toLowerCase() === (bggUsername || "").toLowerCase();
  const canCreate = isOwner && user?.bggConnected && !user?.bggInvalid;

  // Guard: si no es el dueño con BGG conectado, no puede cargar partidas acá.
  useEffect(() => {
    if (!canCreate) navigate(`/bg-watch/${bggUsername}`, { replace: true });
  }, [canCreate, bggUsername, navigate]);

  // Si vino con ?juego, traer los datos del juego para prefijarlo (locked).
  useEffect(() => {
    if (!gameId) return;
    const ac = new AbortController();
    axios
      .get(API.bgg.GAME(gameId), { signal: ac.signal })
      .then(({ data }) => {
        setGame({
          id: data.id,
          name: data.name,
          thumbnail: data.thumbnail,
          year: data.year,
        });
      })
      .catch(() => {});
    return () => ac.abort();
  }, [gameId]);

  const goBack = () => {
    if (gameId) navigate(`/bg-watch/${bggUsername}/juego/${gameId}`);
    else navigate(`/bg-watch/${bggUsername}`);
  };

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setServerError("");
    try {
      await axios.post(API.bgg.PARTIDAS_LIST, payload);
      addToast({ type: "success", message: "Partida cargada en BGG." });
      goBack();
    } catch (err) {
      const msg = getErrorMessage(err, "No se pudo cargar la partida.");
      setServerError(msg);
      addToast({ type: "error", message: msg });
      setSubmitting(false);
    }
  };

  if (!canCreate) return null;
  // Si esperamos los datos del juego prefijado, no montamos el form todavía.
  if (gameId && !game) return null;

  return (
    <PlayForm
      user={user}
      initialValues={game ? { game } : {}}
      lockedGame={!!game}
      submitting={submitting}
      serverError={serverError}
      onSubmit={handleSubmit}
      onCancel={goBack}
    />
  );
}

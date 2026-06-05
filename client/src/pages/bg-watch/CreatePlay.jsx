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
  // Multi-partida rápida: al guardar con "cargar otra", conservamos el roster
  // + ubicación + fecha y remontamos el form (cambiando `formKey`) para la
  // próxima partida sin salir de la página.
  const [keepGoing, setKeepGoing] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [carry, setCarry] = useState(null);

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
      if (keepGoing) {
        // Conservamos el roster (sin score/win/new), la ubicación y la fecha
        // para la próxima partida de la misma junta. El juego se resetea (salvo
        // que esté fijado por ?juego, en cuyo caso se mantiene).
        setCarry({
          players: payload.players.map((p) => ({
            name: p.name,
            username: p.username,
          })),
          location: payload.location,
          playdate: payload.playdate,
        });
        setFormKey((k) => k + 1);
        setSubmitting(false);
        addToast({ type: "success", message: "Partida cargada. Cargá la próxima." });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        addToast({ type: "success", message: "Partida cargada en BGG." });
        goBack();
      }
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

  // El juego se conserva entre cargas sólo si vino fijado por ?juego.
  const baseGame = game ? { game } : {};
  const initialValues = carry
    ? {
        ...baseGame,
        players: carry.players,
        details: { playdate: carry.playdate, location: carry.location },
      }
    : baseGame;

  return (
    <PlayForm
      key={formKey}
      user={user}
      initialValues={initialValues}
      lockedGame={!!game}
      submitting={submitting}
      serverError={serverError}
      onSubmit={handleSubmit}
      onCancel={goBack}
      keepGoing={keepGoing}
      onKeepGoingChange={setKeepGoing}
    />
  );
}

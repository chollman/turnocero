import { useEffect, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
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
  // De dónde se entró al form, para volver ahí (tab/origen). Solo se acepta una
  // ruta interna de BG Watch (evita redirects raros).
  const volver = searchParams.get("volver");
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { addToast, dismiss } = useNotifications();
  // Prefill desde una notif de "partida compartida" (botón "cargar con
  // correcciones"). `sharedFromNotifId` viaja al POST para agradecer al autor
  // y cerrar su notif en el server.
  const prefill = location.state?.prefill || null;
  const sharedFromNotifId = location.state?.sharedFromNotifId || null;

  const [game, setGame] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  // Multi-partida rápida: al guardar con "Guardar y cargar otra", conservamos el
  // roster + ubicación + fecha y remontamos el form (cambiando `formKey`) para la
  // próxima partida sin salir de la página.
  const [formKey, setFormKey] = useState(0);
  const [carry, setCarry] = useState(null);
  // Roster + ubicación de la última partida del usuario, para el botón
  // "Usar última juntada" del form. null = sin partidas previas (no se muestra).
  const [lastJuntada, setLastJuntada] = useState(null);

  const isOwner =
    !!user?.bggUsername &&
    user.bggUsername.toLowerCase() === (bggUsername || "").toLowerCase();
  const canCreate = isOwner && user?.bggConnected && !user?.bggInvalid;

  // Guard: si no es el dueño con BGG conectado, no puede cargar partidas acá.
  // El link de carga no debería depender del username: si quien lo abre tiene
  // SU propia cuenta de BGG (y el link es de otro usuario), lo mandamos a SU
  // página de carga conservando ?juego/?volver y el state (prefill de partida
  // compartida). Si es el dueño pero sin BGG conectado → a su perfil (a
  // reconectar); sin cuenta de BGG → al hub.
  useEffect(() => {
    if (canCreate) return;
    if (user?.bggUsername && !isOwner) {
      navigate(
        `/bg-watch/${user.bggUsername}/partidas/nueva${location.search}`,
        { replace: true, state: location.state },
      );
      return;
    }
    navigate(user?.bggUsername ? `/bg-watch/${bggUsername}` : "/bg-watch", {
      replace: true,
    });
  }, [
    canCreate,
    isOwner,
    user,
    bggUsername,
    navigate,
    location.search,
    location.state,
  ]);

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
          playingTime: data.playingTime ?? null,
        });
      })
      .catch(() => {});
    return () => ac.abort();
  }, [gameId]);

  // Traer la última juntada (roster + ubicación) para ofrecer precargarla. Solo
  // si el usuario puede cargar partidas (dueño con BGG conectado).
  useEffect(() => {
    if (!canCreate) return undefined;
    const ac = new AbortController();
    axios
      .get(API.bgg.ULTIMA_JUNTADA(bggUsername), { signal: ac.signal })
      .then(({ data }) => setLastJuntada(data.juntada || null))
      .catch(() => {});
    return () => ac.abort();
  }, [canCreate, bggUsername]);

  const goBack = () => {
    if (volver && volver.startsWith("/bg-watch/")) navigate(volver);
    else if (gameId) navigate(`/bg-watch/${bggUsername}/juego/${gameId}`);
    else navigate(`/bg-watch/${bggUsername}`);
  };

  const handleSubmit = async (payload, { keepGoing = false } = {}) => {
    setSubmitting(true);
    setServerError("");
    try {
      await axios.post(API.bgg.PARTIDAS_LIST, {
        ...payload,
        ...(sharedFromNotifId ? { sharedFromNotifId } : {}),
      });
      // Si vino de aceptar una partida compartida, sacamos la notif de la
      // bandeja (el server también la borra al agradecer al autor).
      if (sharedFromNotifId) dismiss(sharedFromNotifId);
      if (keepGoing) {
        // Conservamos el roster (sin score/win/new), la ubicación y la fecha
        // para la próxima partida de la misma juntada. El juego se resetea (salvo
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
        addToast({
          type: "success",
          message: "Partida cargada. Cargá la próxima.",
        });
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
  // Prioridad: multi-partida (carry) > prefill de partida compartida > base.
  const initialValues = carry
    ? {
        ...baseGame,
        players: carry.players,
        details: { playdate: carry.playdate, location: carry.location },
      }
    : prefill || baseGame;

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
      allowMultiSave
      lastJuntada={lastJuntada}
    />
  );
}

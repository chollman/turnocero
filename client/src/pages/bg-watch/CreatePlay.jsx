import { useEffect, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { useBggGameQuery } from "../../queries/bgg";
import {
  useUltimaJuntadaQuery,
  createBgWatchPlay,
} from "../../queries/bgWatch";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { createJuntada, toGamePayload } from "../compartidas/createJuntada";
import { buildCompartidaShare } from "../../utils/share";
import { getShortUrl } from "../../utils/shortlink";
import PlayForm from "./PlayForm";

/**
 * Página de cargar una partida (`/bg-watch/:bggUsername/partidas/nueva`).
 * Acepta `?juego=<gameId>` para prefijar el juego (desde la vista por-juego).
 * Solo el dueño con BGG conectado puede entrar; si no, redirige al perfil.
 */
export default function CreatePlay() {
  const { t } = useTranslation("bgwatch");
  const { bggUsername } = useParams();
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get("juego") || null;
  // De dónde se entró al form, para volver ahí (tab/origen). Solo se acepta una
  // ruta interna de BG Watch (evita redirects raros).
  const volver = searchParams.get("volver");
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { addToast, markSharedPlayLoaded } = useNotifications();
  // Prefill desde una notif de "partida compartida" (botón "cargar con
  // correcciones"). `sharedFromNotifId` viaja al POST para agradecer al autor
  // y cerrar su notif en el server.
  const prefill = location.state?.prefill || null;
  const sharedFromNotifId = location.state?.sharedFromNotifId || null;

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  // Multi-partida rápida: al guardar con "Guardar y cargar otra", conservamos el
  // roster + ubicación + fecha y remontamos el form (cambiando `formKey`) para la
  // próxima partida sin salir de la página.
  const [formKey, setFormKey] = useState(0);
  const [carry, setCarry] = useState(null);

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
  const { data: gameDetails } = useBggGameQuery(gameId, { enabled: !!gameId });
  const game = gameDetails
    ? {
        id: gameDetails.id,
        name: gameDetails.name,
        thumbnail: gameDetails.thumbnail,
        year: gameDetails.year,
        playingTime: gameDetails.playingTime ?? null,
      }
    : null;

  // Traer la última juntada (roster + ubicación) para ofrecer precargarla. Solo
  // si el usuario puede cargar partidas (dueño con BGG conectado).
  const { data: lastJuntada = null } = useUltimaJuntadaQuery(bggUsername, {
    enabled: canCreate,
  });

  const goBack = () => {
    if (volver && volver.startsWith("/bg-watch/")) navigate(volver);
    else if (gameId) navigate(`/bg-watch/${bggUsername}/juego/${gameId}`);
    else navigate(`/bg-watch/${bggUsername}`);
  };

  // Crea la juntada de la sección 5 (si vino) y copia su deeplink al
  // portapapeles. AISLADO del guardado de la partida: cualquier fallo acá no
  // revierte la partida (ya guardada) — solo se reporta con un toast no
  // bloqueante. Devuelve { ok, url } | { error: true } | null (sin share).
  const runShare = async (share) => {
    if (!share) return null;
    try {
      const finalPost = await createJuntada({
        payload: {
          category: "juntada",
          community: share.community || undefined,
          title: share.title.trim(),
          body: share.body.trim(),
          boardGames: share.games.map(toGamePayload),
          privacy: share.privacy,
          playResult: share.playResult || undefined,
        },
        files: share.images,
        crosspostInstagram: share.crosspostInstagram,
      });
      share.images.forEach(
        (img) => img.preview && URL.revokeObjectURL(img.preview),
      );
      const { url: longUrl } = buildCompartidaShare(
        finalPost,
        window.location.origin,
      );
      // Preferimos el short link (más lindo para WhatsApp/Telegram); si no
      // resuelve, copiamos el deeplink largo (la juntada igual existe).
      const url =
        (await getShortUrl({
          type: "compartida",
          ref: finalPost._id,
          origin: window.location.origin,
        })) || longUrl;
      try {
        // Es una acción del usuario (click en Guardar), así que el navegador
        // permite el copy. Si el contexto es inseguro o se deniega, no rompe:
        // la juntada igual se creó.
        await navigator.clipboard?.writeText(url);
      } catch {
        /* clipboard no disponible — la juntada igual existe */
      }
      return { ok: true, url, instagramError: finalPost.instagramCrosspostError };
    } catch {
      return { error: true };
    }
  };

  const handleSubmit = async (payload, { keepGoing = false, share = null } = {}) => {
    setSubmitting(true);
    setServerError("");

    // 1. Guardar la partida (paso propio). Si falla, NO se intenta la juntada.
    try {
      await createBgWatchPlay({
        ...payload,
        ...(sharedFromNotifId ? { sharedFromNotifId } : {}),
      });
    } catch (err) {
      const msg = getErrorMessage(err, t("createPlay.savePlayError"));
      setServerError(msg);
      addToast({ type: "error", message: msg });
      setSubmitting(false);
      return;
    }

    // Partida OK desde acá. Si vino de aceptar una partida compartida, marcamos
    // su notif como cargada (el server ya la dejó leída al agradecer al autor):
    // pierde los botones pero queda en la bandeja hasta que el usuario la limpie.
    if (sharedFromNotifId) markSharedPlayLoaded(sharedFromNotifId);

    // 2. Sección 5 opcional: crear la juntada + copiar el deeplink (aislado).
    const shareResult = await runShare(share);

    // 3. Toasts + navegación según keepGoing.
    if (keepGoing) {
      // Conservamos el roster (sin score/win/new), la ubicación y la fecha
      // para la próxima partida de la misma juntada. El juego se resetea (salvo
      // que esté fijado por ?juego, en cuyo caso se mantiene). La sección 5 NO
      // se conserva: cada juntada es de una partida puntual.
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
        message: shareResult?.ok
          ? t("createPlay.playLoadedShareCopiedNext")
          : t("createPlay.playLoadedNext"),
      });
      if (shareResult?.error) {
        addToast({
          type: "error",
          message: t("createPlay.shareFailed"),
        });
      } else if (shareResult?.instagramError) {
        addToast({ type: "error", message: shareResult.instagramError });
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      addToast({
        type: "success",
        message: shareResult?.ok
          ? t("createPlay.playLoadedShareCopied")
          : t("createPlay.playLoadedBgg"),
      });
      if (shareResult?.error) {
        addToast({
          type: "error",
          message: t("createPlay.shareFailed"),
        });
      } else if (shareResult?.instagramError) {
        addToast({ type: "error", message: shareResult.instagramError });
      }
      goBack();
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

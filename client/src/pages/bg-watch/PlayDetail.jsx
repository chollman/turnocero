import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import axios from "axios";
import { Helmet } from "react-helmet-async";
import { API } from "../../api/endpoints";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { useShortLink } from "../../hooks/useShortLink";
import { useBrandName } from "../../hooks/useBrandName";
import { buildPartidaShare } from "../../utils/share";
import Avatar from "../../components/shared/Avatar";
import Meeple from "../../components/shared/Meeple";
import BackButton from "../../components/shared/BackButton";
import ConfirmActionModal from "../../components/shared/ConfirmActionModal";
import NotFound from "../error/NotFound";
import useBggUserMap from "./useBggUserMap";
import { hasDisplayableScore } from "./playerScore";
import GroupStatsPanel from "./GroupStatsPanel";
import styles from "./PlayDetail.module.css";

function formatFullDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// 2 letras para el thumbnail fallback: iniciales de las 2 primeras palabras,
// o las 2 primeras letras si es una sola (helper del handoff).
export function gameInitials(name) {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const KNOWN_COLORS = {
  red: "#d44",
  rojo: "#d44",
  blue: "#46c",
  azul: "#46c",
  green: "#3a3",
  verde: "#3a3",
  yellow: "#dc4",
  amarillo: "#dc4",
  black: "#222",
  negro: "#222",
  white: "#eee",
  blanco: "#eee",
  orange: "#e80",
  naranja: "#e80",
  purple: "#83b",
  morado: "#83b",
  violeta: "#83b",
  pink: "#e9a",
  rosa: "#e9a",
  brown: "#864",
  marron: "#864",
  marrón: "#864",
  gray: "#888",
  grey: "#888",
  gris: "#888",
};

function colorSwatch(name) {
  if (!name) return null;
  const k = name.trim().toLowerCase();
  return KNOWN_COLORS[k] || k;
}

function PlayerRow({ player, index, turnoceroUser, brandName }) {
  // Un override de curación (overlayName / overlayAvatar) gana sobre el
  // perfil del miembro — igual que PlayCard.
  const displayName = player.overlayName
    ? player.overlayName
    : turnoceroUser
      ? turnoceroUser.displayName || turnoceroUser.username
      : player.name || player.username || "Anónimo";
  const swatch = colorSwatch(player.color);
  const rankCls =
    index === 0
      ? styles.rankGold
      : index === 1
        ? styles.rankSilver
        : index === 2
          ? styles.rankBronze
          : "";

  return (
    <div
      className={`${styles.playersRow} ${player.win ? styles.rowWinner : ""}`}
    >
      <div className={`${styles.rank} ${rankCls}`}>
        {player.position ? `#${player.position}` : "—"}
      </div>
      <div className={styles.player}>
        {player.overlayAvatar?.url ? (
          <Avatar
            user={{
              _id: player.username || player.name,
              displayName,
              avatar: player.overlayAvatar,
            }}
            size="sm"
          />
        ) : (
          turnoceroUser && <Avatar user={turnoceroUser} size="sm" />
        )}
        <div className={styles.playerNames}>
          <div className={styles.playerName}>
            <span>{displayName}</span>
            {player.new && (
              <span className={styles.newBadge} title="Primera vez que lo jugó">
                ✨ nuevo
              </span>
            )}
          </div>
          <div className={styles.playerMeta}>
            {turnoceroUser ? (
              <Link
                to={`/usuarios/${turnoceroUser._id}`}
                className={styles.playerUsername}
                title={`Ver perfil en ${brandName}`}
              >
                @{turnoceroUser.username} · en {brandName}
              </Link>
            ) : (
              player.username && (
                <a
                  href={`https://boardgamegeek.com/user/${player.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.playerUsername}
                >
                  @{player.username}
                </a>
              )
            )}
            {player.rating > 0 && (
              <span
                className={styles.playerRating}
                title="Rating que le puso al juego"
              >
                ★ {player.rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className={`${styles.colorChip} ${styles.colorCol}`}>
        {player.color ? (
          <>
            <span
              className={styles.colorDot}
              style={swatch ? { background: swatch } : undefined}
            />
            {player.color}
          </>
        ) : (
          <span className={styles.dimText}>—</span>
        )}
      </div>
      <div className={styles.scoreCell}>
        {hasDisplayableScore(player.score) ? (
          player.score
        ) : (
          <span className={styles.dimText}>—</span>
        )}
      </div>
      <div className={styles.outcomeCell}>
        {player.win ? (
          <span className={styles.outcomeWin}>✦ Ganó</span>
        ) : (
          <span className={styles.dimText}>—</span>
        )}
      </div>
    </div>
  );
}

const WhatsAppIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.535 5.862L.057 23.886a.5.5 0 0 0 .612.612l6.05-1.48A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.65-.51-5.166-1.396l-.37-.22-3.827.934.952-3.782-.243-.388A9.955 9.955 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
  </svg>
);

const TelegramIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.08 13.63l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.834.931z" />
  </svg>
);

const LinkIcon = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const CheckIcon = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default function PlayDetail() {
  const { bggUsername, playId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const brandName = useBrandName();

  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Short link transparente (eager: página de detalle, un solo recurso). El
  // ref usa el username en lowercase para dedup-ear con cualquier otra fuente.
  const { shortUrl } = useShortLink({
    type: "partida",
    ref: `${(bggUsername || "").toLowerCase()}/${playId}`,
    eager: true,
  });

  useEffect(() => {
    const ac = new AbortController();
    setData(null);
    setNotFound(false);
    setError(false);
    axios
      .get(API.bgg.PARTIDA_DETALLE(bggUsername, playId), { signal: ac.signal })
      .then(({ data: d }) => setData(d))
      .catch((err) => {
        if (axios.isCancel(err)) return;
        if (err.response?.status === 404) setNotFound(true);
        else setError(true);
      });
    return () => ac.abort();
  }, [bggUsername, playId]);

  const play = data?.play || null;
  const game = data?.game || null;
  const userMap = useBggUserMap(play ? [play] : null);

  const isOwner =
    !!user?.bggUsername &&
    user.bggUsername.toLowerCase() === (bggUsername || "").toLowerCase();
  const canManage = isOwner && user?.bggConnected && !user?.bggInvalid;

  // Asiento del dueño del log (post-overlay un alias "sos vos" ya trae su
  // username), para el bloque de puntaje y el color del valor.
  const ownerSeat = useMemo(() => {
    if (!play?.players) return null;
    const lower = (bggUsername || "").toLowerCase();
    return (
      play.players.find((p) => (p.username || "").toLowerCase() === lower) ||
      null
    );
  }, [play, bggUsername]);

  const sortedPlayers = useMemo(() => {
    if (!play?.players) return [];
    return [...play.players].sort((a, b) => {
      if (a.win !== b.win) return a.win ? -1 : 1;
      const aPos = a.position ? Number(a.position) : 999;
      const bPos = b.position ? Number(b.position) : 999;
      if (Number.isFinite(aPos) && Number.isFinite(bPos) && aPos !== bPos)
        return aPos - bPos;
      return 0;
    });
  }, [play]);

  const heroImage =
    game?.image || game?.thumbnail || play?.gameThumbnail || null;

  const share = play
    ? buildPartidaShare(
        play,
        bggUsername,
        typeof window !== "undefined" ? window.location.origin : "",
        shortUrl || undefined,
      )
    : null;

  // Volver: in-app → atrás; entrada directa (deep-link/short link) → el
  // listado de partidas del perfil (memory: feedback-router-back-button-idx).
  const handleBack = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate(`/bg-watch/${bggUsername}/partidas`);
  };

  const handleCopy = () => {
    if (!share) return;
    navigator.clipboard?.writeText(share.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await axios.delete(API.bgg.PARTIDA_DETAIL(playId));
      navigate(`/bg-watch/${bggUsername}/partidas`, { replace: true });
    } catch (err) {
      addToast({
        type: "error",
        message:
          err.response?.data?.message || "No se pudo eliminar la partida.",
      });
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  if (notFound) return <NotFound />;

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <BackButton onClick={handleBack} flush>
            Volver
          </BackButton>
          <div className={styles.stateCenter}>
            <p>No se pudo cargar la partida.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!play) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <BackButton onClick={handleBack} flush>
            Volver
          </BackButton>
          <div className={styles.skeletonHero} />
          <div className={styles.skeletonTable} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Helmet>
        <title>
          {play.gameName
            ? `Partida de ${play.gameName} – BG Watch`
            : "Partida – BG Watch"}
        </title>
      </Helmet>
      <div className={styles.inner}>
        <BackButton onClick={handleBack} flush>
          Volver
        </BackButton>

        {/* ── Hero ── */}
        <header className={styles.hero}>
          {heroImage ? (
            <div className={styles.heroThumb}>
              <img src={heroImage} alt={play.gameName || "Juego"} />
            </div>
          ) : (
            <div className={styles.heroThumbFallback} aria-hidden="true">
              {gameInitials(play.gameName)}
            </div>
          )}

          <div className={styles.heroInfo}>
            <div className={styles.kicker}>
              <Meeple />
              Partida #{play.id} · de{" "}
              <Link
                to={`/bg-watch/${encodeURIComponent(bggUsername)}`}
                className={styles.heroLink}
              >
                {bggUsername}
              </Link>
            </div>
            <h1 className={styles.gameTitle}>
              {play.gameName || "Sin nombre"}
            </h1>
            <div className={styles.pills}>
              {play.date && (
                <span className={styles.pill}>
                  📅 {formatFullDate(play.date)}
                </span>
              )}
              {play.location && (
                <span className={styles.pill}>📍 {play.location}</span>
              )}
              {play.duration > 0 && (
                <span className={styles.pill}>⏱ {play.duration} min</span>
              )}
              {play.players?.length > 0 && (
                <span className={styles.pill}>
                  👥 {play.players.length}{" "}
                  {play.players.length === 1 ? "jugador" : "jugadores"}
                </span>
              )}
              {play.quantity > 1 && (
                <span className={styles.pill}>×{play.quantity} partidas</span>
              )}
              {play.incomplete && (
                <span className={`${styles.pill} ${styles.pillWarn}`}>
                  Incompleta
                </span>
              )}
              {play.nowinstats && (
                <span className={`${styles.pill} ${styles.pillMuted}`}>
                  No cuenta para ranking
                </span>
              )}
            </div>
            {play.gameId && (
              <div className={styles.heroLinks}>
                <Link
                  to={`/bg-watch/${encodeURIComponent(bggUsername)}/juego/${play.gameId}`}
                  className={styles.heroLink}
                >
                  Ver juego en BG Watch →
                </Link>
                <a
                  href={`https://boardgamegeek.com/boardgame/${play.gameId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.heroLink}
                >
                  Ver en BoardGameGeek ↗
                </a>
              </div>
            )}
          </div>

          {ownerSeat && hasDisplayableScore(ownerSeat.score) && (
            <div className={styles.score}>
              <div className={styles.scoreLbl}>
                {isOwner ? "Tu puntaje" : `Puntaje de ${bggUsername}`}
              </div>
              <div
                className={`${styles.scoreVal} ${ownerSeat.win ? styles.scoreWin : ""}`}
              >
                {ownerSeat.score}
              </div>
            </div>
          )}

          <div className={styles.heroFooter}>
            <div className={styles.shareRow}>
              <span className={styles.shareLabel}>Compartir</span>
              <a
                className={styles.shareBtn}
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(share.whatsappText)}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Compartir en WhatsApp"
              >
                {WhatsAppIcon}
                <span>WhatsApp</span>
              </a>
              <a
                className={styles.shareBtn}
                href={`https://t.me/share/url?url=${encodeURIComponent(share.url)}&text=${encodeURIComponent(share.caption)}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Compartir en Telegram"
              >
                {TelegramIcon}
                <span>Telegram</span>
              </a>
              <button
                type="button"
                className={`${styles.shareBtn} ${copied ? styles.shareBtnCopied : ""}`}
                onClick={handleCopy}
                title={copied ? "¡Copiado!" : "Copiar enlace"}
              >
                {copied ? CheckIcon : LinkIcon}
                <span>{copied ? "¡Copiado!" : "Copiar"}</span>
              </button>
            </div>

            {canManage && (
              <div className={styles.ownerActions}>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() =>
                    navigate(
                      `/bg-watch/${encodeURIComponent(bggUsername)}/partidas/nueva?juego=${play.gameId}&volver=${encodeURIComponent(location.pathname)}`,
                    )
                  }
                >
                  Cargar otra
                </button>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() =>
                    navigate(
                      `/bg-watch/${encodeURIComponent(bggUsername)}/partidas/${play.id}/editar`,
                      { state: { play } },
                    )
                  }
                >
                  Editar
                </button>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                  onClick={() => setConfirmingDelete(true)}
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ── Resultados ── */}
        {sortedPlayers.length > 0 && (
          <>
            <div className={styles.ruleLine}>
              <span>
                <Meeple /> Resultados
              </span>
            </div>
            <div className={styles.playersTable}>
              <div className={styles.playersHead}>
                <div>#</div>
                <div>Jugador</div>
                <div className={styles.colorCol}>Color</div>
                <div>Puntaje</div>
                <div>Resultado</div>
              </div>
              {sortedPlayers.map((p, i) => (
                <PlayerRow
                  key={`${p.username || p.name || "anon"}-${i}`}
                  player={p}
                  index={i}
                  turnoceroUser={
                    p.username ? userMap?.[p.username.toLowerCase()] : null
                  }
                  brandName={brandName}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Mismo grupo ── */}
        {(play.players?.length || 0) >= 2 && (
          <GroupStatsPanel
            bggUsername={bggUsername}
            playId={play.id}
            userMap={userMap}
          />
        )}

        {/* ── Notas ── */}
        {play.comments && (
          <div className={styles.notes}>
            <div className={styles.notesHead}>
              <Meeple /> {isOwner ? "Tus notas" : "Notas"}
            </div>
            <p className={styles.notesBody}>"{play.comments}"</p>
          </div>
        )}
      </div>

      <ConfirmActionModal
        isOpen={confirmingDelete}
        title="Eliminar partida"
        message={`¿Eliminar la partida de "${play.gameName}" del ${play.date || "?"}? Esta acción no se puede deshacer y borra la partida en BGG.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setConfirmingDelete(false)}
      />
    </div>
  );
}

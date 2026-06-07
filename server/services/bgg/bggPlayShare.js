// "Partida compartida": cuando un usuario carga una partida en BG Watch y el
// roster incluye a otros usuarios de TurnoCero (match por bggUsername), esos
// co-jugadores reciben una notificación rica con el detalle de la partida y
// dos acciones — "cargar como aparece" / "cargar con correcciones". Al
// concretarse la carga, el autor original recibe un agradecimiento.
//
// Resolución jugador → usuario: `resolveUsersByBggUsernames` (case-insensitive
// sobre `bggUsername`, excluye baneados). Notificamos a TODO co-jugador que sea
// usuario de TurnoCero aunque no tenga BGG conectado — la tarjeta del cliente
// les muestra un CTA para conectar en vez de los botones de carga.

const mongoose = require("mongoose");
const Notification = require("../../models/Notification");
const { emitNotificationReq } = require("../../utils/emitNotification");
const { resolveUsersByBggUsernames } = require("../userLookup");
const { resolveGame } = require("./bggResolve");

// Arma el snapshot embebido a partir del input del autor (`body`, autoridad)
// enriquecido con el nombre/imagen del juego y el id de la partida creada.
function buildSnapshot(body, game, playId) {
  const players = Array.isArray(body.players) ? body.players : [];
  return {
    playId: String(playId),
    gameId: String(body.objectid),
    gameName: game?.name || "",
    gameThumbnail: game?.thumbnail || "",
    gameImage: game?.image || "",
    date: body.playdate || "",
    duration:
      body.length != null && body.length !== ""
        ? Number(body.length) || null
        : null,
    // La ubicación NO se comparte: es un dato privado de quien cargó la partida
    // y no debe replicarse en la notif ni en la carga del co-jugador.
    comments: body.comments || "",
    incomplete: !!body.incomplete,
    nowinstats: !!body.nowinstats,
    quantity: Number(body.quantity) || 1,
    players: players.map((p) => ({
      name: p.name || "",
      username: p.username || "",
      position: p.position ?? null,
      color: p.color || "",
      score: p.score ?? "",
      win: !!p.win,
      new: !!p.new,
      rating:
        p.rating != null && Number(p.rating) > 0 ? Number(p.rating) : null,
    })),
  };
}

// Notifica a cada co-jugador (usuario de TurnoCero, distinto del autor) que el
// autor cargó una partida en la que participaron. Best-effort por destinatario.
async function notifyPlayParticipants({ req, author, body, playId }) {
  const usernames = (Array.isArray(body.players) ? body.players : [])
    .map((p) => (p.username || "").trim())
    .filter(Boolean);
  if (usernames.length === 0) return;

  const matched = await resolveUsersByBggUsernames(usernames);
  const recipients = matched.filter(
    (u) => String(u._id) !== String(author._id),
  );
  if (recipients.length === 0) return;

  const game = await resolveGame(body.objectid).catch(() => null);
  const snapshot = buildSnapshot(body, game, playId);

  await Promise.all(
    recipients.map((u) =>
      emitNotificationReq(
        req,
        u._id,
        "bgg_play_shared",
        {
          fromUserId: String(author._id),
          fromUsername: author.displayName || author.username,
          playId: snapshot.playId,
          gameName: snapshot.gameName,
          playSnapshot: snapshot,
        },
        "bgg:play-shared",
        {},
      ).catch(() => {}),
    ),
  );
}

// Cuando un destinatario carga la partida compartida (como aparece o con
// correcciones), agradece al autor y borra la notif original (idempotente:
// no-op si ya se resolvió / el notifId es inválido). Devuelve la notif
// consumida o null.
async function acknowledgeSharedPlay({ req, recipient, notifId }) {
  if (!notifId || !mongoose.isValidObjectId(notifId)) return null;
  const notif = await Notification.findOne({
    _id: notifId,
    recipient: recipient._id,
    type: "bgg_play_shared",
  });
  if (!notif) return null;

  await emitNotificationReq(
    req,
    notif.fromUserId,
    "bgg_play_accepted",
    {
      fromUserId: String(recipient._id),
      fromUsername: recipient.displayName || recipient.username,
      playId: notif.playId,
      gameName: notif.gameName,
    },
    "bgg:play-accepted",
    {},
  ).catch(() => {});

  await Notification.deleteOne({ _id: notif._id });
  return notif;
}

module.exports = {
  buildSnapshot,
  notifyPlayParticipants,
  acknowledgeSharedPlay,
};

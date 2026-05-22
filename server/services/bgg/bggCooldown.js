// Cooldown server-side para el botón "↻ Actualizar" de los paneles BG
// Watch (PartidasPanel + ColeccionPanel). Persistido en
// `User.bggSync.lastManualRefresh{Partidas,Coleccion}At` así sobrevive
// recargas y es uniforme entre clientes del mismo usuario.
//
// CONTRATO (memory: feedback-bgg-cache-pattern):
// El server debe gatear regardless of auth — un curl directo con
// ?refresh=1 también debe ser throttled. El cliente solo muestra el
// botón al dueño del perfil o admin, pero el endpoint protege en
// ambas direcciones.
//
// La response del endpoint incluye `X-Refresh-Cooldown-Ms` header
// (tanto en 200 como en 429) para que el cliente sincronice su
// countdown desde la fuente de verdad — no hay setter optimista.
//
// CASE-INSENSITIVE LOOKUP (memory: feedback-bgg-username-case):
// `User.bggUsername` es case-preserved; `BggPlay.bggUsername` es
// lowercase. Los lookups acá usan `collation strength: 2` para
// matchear MixedCase correctamente.

const User = require("../../models/User");

const MANUAL_REFRESH_COOLDOWN_MS = 60 * 1000; // 60s

function fieldForPanel(panel) {
  return panel === "partidas"
    ? "bggSync.lastManualRefreshPartidasAt"
    : "bggSync.lastManualRefreshColeccionAt";
}

// Devuelve milisegundos restantes hasta que el cooldown expire.
// 0 si el user puede refrescar ahora (no hay stamp previo o pasó el
// window de 60s).
async function getManualRefreshRemainingMs(bggUsername, panel) {
  if (!bggUsername) return 0;
  const field = fieldForPanel(panel);
  const user = await User.findOne({ bggUsername })
    .collation({ locale: "en", strength: 2 })
    .select(field)
    .lean();
  // No Turnocero user owns this bggUsername — no podemos persistir el
  // stamp, permitimos el refresh. Edge case raro (perfil público sin
  // user en nuestra DB).
  if (!user) return 0;
  const last =
    panel === "partidas"
      ? user.bggSync?.lastManualRefreshPartidasAt
      : user.bggSync?.lastManualRefreshColeccionAt;
  if (!last) return 0;
  const elapsed = Date.now() - new Date(last).getTime();
  return elapsed >= MANUAL_REFRESH_COOLDOWN_MS
    ? 0
    : MANUAL_REFRESH_COOLDOWN_MS - elapsed;
}

// Marca el stamp del último refresh manual. Caller hace esto DESPUÉS
// de servir la response 200 — el próximo refresh tendrá que esperar
// el window completo de 60s.
async function stampManualRefresh(bggUsername, panel) {
  if (!bggUsername) return;
  const field = fieldForPanel(panel);
  await User.updateOne(
    { bggUsername },
    { $set: { [field]: new Date() } },
  ).collation({ locale: "en", strength: 2 });
}

module.exports = {
  MANUAL_REFRESH_COOLDOWN_MS,
  getManualRefreshRemainingMs,
  stampManualRefresh,
};

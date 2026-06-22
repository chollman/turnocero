// Traduce los errores de los endpoints de BGG de la sección de perfil a
// mensajes claros y accionables según el status HTTP, para que el usuario
// entienda *qué* pasó al apretar el botón. El server ya distingue los casos
// (status 401 vs 502 vs 404…), pero su copy es escueto; acá lo enriquecemos
// para que sea autoexplicativo.
//
// `brandName` se pasa donde aplica para respetar la marca por tenant (un
// subdominio de comunidad muestra el nombre de la comunidad, no "TurnoCero").
//
// El copy fijo sale por i18n (singleton — funciones puras, idioma runtime). Los
// branches que devuelven `serverMsg` (string del server) NO se traducen.
import i18n from "../i18n";

// ── POST /api/auth/bgg-connect ───────────────────────────────────────────
//   401              → la password de BGG es incorrecta (lo más común — el
//                      usuario suele confundirla con la de TurnoCero/community).
//   502 / 503 / 504  → BGG no respondió (caído o lento). No es su password.
//   400              → falta un dato; el mensaje del server ya es claro.
//   sin response     → problema de red local.
export function bggConnectErrorMessage(err, { brandName = "TurnoCero" } = {}) {
  const status = err?.response?.status;
  const serverMsg = err?.response?.data?.message;

  if (status === 401) {
    return i18n.t("enums:bgg.connect.wrongPassword", { brandName });
  }
  if (status === 502 || status === 503 || status === 504) {
    return i18n.t("enums:bgg.connect.unavailable");
  }
  if (status === 400 && typeof serverMsg === "string" && serverMsg.trim()) {
    return serverMsg;
  }
  if (!err?.response) {
    return i18n.t("enums:bgg.connect.network");
  }
  if (typeof serverMsg === "string" && serverMsg.trim()) {
    return serverMsg;
  }
  return i18n.t("enums:bgg.connect.generic");
}

// ── POST /api/bgg/sync ("Reconciliar todo con BGG") ──────────────────────
//   404              → el username de BGG no existe en BGG.
//   502 / 503 / 504  → BGG falló a mitad del walk (reconcile no destructivo:
//                      lo ya sincronizado queda intacto).
//   400              → falta configurar el username (copy claro del server).
//   429              → demasiados syncs seguidos (copy claro del server).
//   sin response     → problema de red local.
// Nota: a diferencia de connect, NO hay caso "password incorrecta" — el sync
// son lecturas públicas, no usa las credenciales.
export function bggSyncErrorMessage(err) {
  const status = err?.response?.status;
  const serverMsg = err?.response?.data?.message;

  if (status === 404) {
    return i18n.t("enums:bgg.sync.notFound");
  }
  if (status === 502 || status === 503 || status === 504) {
    return i18n.t("enums:bgg.sync.failed");
  }
  if (
    (status === 400 || status === 429) &&
    typeof serverMsg === "string" &&
    serverMsg.trim()
  ) {
    return serverMsg;
  }
  if (!err?.response) {
    return i18n.t("enums:bgg.sync.network");
  }
  if (typeof serverMsg === "string" && serverMsg.trim()) {
    return serverMsg;
  }
  return i18n.t("enums:bgg.sync.generic");
}

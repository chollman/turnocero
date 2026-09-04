// Conexión + publicación en Instagram (cross-post de Compartidas) vía la
// Graph API de Meta. Reusa la MISMA app de Facebook que el login OAuth
// (FB_APP_ID/FB_APP_SECRET) — necesita además los productos/permisos
// instagram_basic, instagram_content_publish, pages_show_list,
// pages_read_engagement habilitados en esa app.
//
// Instagram Content Publishing solo funciona con cuentas Instagram Business
// o Creator vinculadas a una Página de Facebook — nunca con cuentas
// personales. El flujo de conexión (esta Fase 1) es:
//   1. El cliente abre el popup del SDK de Facebook pidiendo los scopes de
//      arriba y nos manda el user access token (short-lived) resultante.
//   2. exchangeLongLivedToken(): lo cambiamos por uno long-lived (~60 días).
//   3. findInstagramPage(): buscamos, entre las Páginas que administra, la
//      primera que tenga una cuenta de Instagram Business vinculada — el
//      Page Access Token de esa página es el que persistimos cifrado (las
//      llamadas de publish usan el token de la Página, no el del usuario).
//   4. fetchIgUsername(): solo para mostrar el @handle en /perfil.
//
// Publicación (Fase 3): crear contenedor(es) de media → poll de status_code
// hasta FINISHED → media_publish. Feed soporta carrusel (2-3 fotos, dentro
// del límite de 10 de Instagram); Historias NO soporta carrusel — si el
// usuario tildó "Historias" con varias fotos, el caller (jobs/instagramPublish.js)
// solo pasa la primera. Todo esto corre en el cron, nunca en el request HTTP
// que crea la Compartida (ver plan de Fase 3).

const httpError = require("../utils/httpError");

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const MAX_CAPTION_LENGTH = 2200; // límite de Instagram para el caption

// Scopes que el cliente debe pedir en el popup de conexión y que validamos
// acá antes de guardar nada — sin todos estos, publicar después fallará.
const REQUIRED_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
];

// Adjunta el código/tipo de error de Meta al httpError lanzado, para que el
// caller (jobs/instagramPublish.js) pueda decidir si marcar
// user.instagramCredentials.invalid = true (token revocado/expirado) sin
// tener que re-parsear el mensaje.
function graphErrorFrom(res, data) {
  const isAuthError =
    res.status === 401 || data?.error?.type === "OAuthException";
  const err = httpError(
    isAuthError ? 401 : 502,
    data?.error?.message || `Graph API respondió ${res.status}`,
  );
  err.igErrorCode = data?.error?.code;
  err.igErrorType = data?.error?.type;
  return err;
}

async function graphGet(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  let res;
  try {
    res = await fetch(`${GRAPH_BASE}${path}?${qs}`);
  } catch (e) {
    throw httpError(502, `No se pudo contactar la Graph API de Meta: ${e.message}`);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.error) throw graphErrorFrom(res, data);
  return data;
}

async function graphPost(path, params = {}) {
  let res;
  try {
    res = await fetch(`${GRAPH_BASE}${path}`, {
      method: "POST",
      body: new URLSearchParams(params),
    });
  } catch (e) {
    throw httpError(502, `No se pudo contactar la Graph API de Meta: ${e.message}`);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.error) throw graphErrorFrom(res, data);
  return data;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Valida un access token contra /debug_token (mismo chequeo que
 * POST /oauth/facebook) y confirma que tiene todos los scopes requeridos
 * para publicar en Instagram. Lanza httpError si algo no cierra.
 */
async function validateAccessToken(accessToken) {
  if (!process.env.FB_APP_ID || !process.env.FB_APP_SECRET) {
    throw httpError(503, "La conexión con Instagram no está configurada");
  }
  const appToken = `${process.env.FB_APP_ID}|${process.env.FB_APP_SECRET}`;
  const { data: debug } = await graphGet("/debug_token", {
    input_token: accessToken,
    access_token: appToken,
  });

  if (!debug?.is_valid || debug.app_id !== process.env.FB_APP_ID) {
    throw httpError(401, "Token de Facebook inválido");
  }
  const grantedScopes = new Set(debug.scopes || []);
  const missing = REQUIRED_SCOPES.filter((s) => !grantedScopes.has(s));
  if (missing.length > 0) {
    throw httpError(
      400,
      `Faltan permisos para publicar en Instagram: ${missing.join(", ")}`,
    );
  }
  return debug;
}

/**
 * Cambia un user access token short-lived por uno long-lived (~60 días).
 */
async function exchangeLongLivedToken(shortLivedUserToken) {
  const data = await graphGet("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: process.env.FB_APP_ID,
    client_secret: process.env.FB_APP_SECRET,
    fb_exchange_token: shortLivedUserToken,
  });
  if (!data?.access_token) {
    throw httpError(502, "Meta no devolvió un token de larga duración");
  }
  return data.access_token;
}

/**
 * Busca, entre las Páginas de Facebook que administra el usuario, la primera
 * que tenga una cuenta de Instagram Business/Creator vinculada. Devuelve
 * `{ pageId, pageName, pageAccessToken, igUserId }` o `null` si ninguna
 * Página tiene Instagram vinculado.
 *
 * Si el usuario administra varias Páginas con distintas cuentas de
 * Instagram, v1 toma la primera encontrada — no arma un selector (queda
 * documentado como mejora futura si algún usuario lo necesita).
 */
async function findInstagramPage(longLivedUserToken) {
  const { data: pages } = await graphGet("/me/accounts", {
    access_token: longLivedUserToken,
    fields: "id,name,access_token",
  });

  for (const page of pages || []) {
    const pageInfo = await graphGet(`/${page.id}`, {
      fields: "instagram_business_account",
      access_token: page.access_token,
    });
    const igUserId = pageInfo?.instagram_business_account?.id;
    if (igUserId) {
      return {
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
        igUserId,
      };
    }
  }
  return null;
}

/**
 * Resuelve el @handle de una cuenta de Instagram Business, solo para
 * mostrarlo en /perfil.
 */
async function fetchIgUsername(igUserId, pageAccessToken) {
  const data = await graphGet(`/${igUserId}`, {
    fields: "username",
    access_token: pageAccessToken,
  });
  return data?.username || "";
}

/**
 * Arma el texto del post a partir de una Compartida: título + cuerpo +
 * nombres de los juegos jugados, capado al límite de Instagram.
 */
function buildCaption(compartida) {
  const parts = [];
  if (compartida.title) parts.push(compartida.title);
  if (compartida.body) parts.push(compartida.body);
  const games = (compartida.boardGames || [])
    .map((g) => g.name)
    .filter(Boolean);
  if (games.length > 0) parts.push(games.join(" · "));
  const caption = parts.join("\n\n").trim();
  return caption.length > MAX_CAPTION_LENGTH
    ? `${caption.slice(0, MAX_CAPTION_LENGTH - 1)}…`
    : caption;
}

/**
 * Crea un contenedor de imagen. `isCarouselItem: true` lo arma como hijo de
 * un carrusel (sin caption propio — el caption va en el contenedor del
 * carrusel). Devuelve el id del contenedor.
 */
async function createImageContainer({
  igUserId,
  pageAccessToken,
  imageUrl,
  caption = "",
  isCarouselItem = false,
}) {
  const params = { image_url: imageUrl, access_token: pageAccessToken };
  if (isCarouselItem) {
    params.is_carousel_item = "true";
  } else if (caption) {
    params.caption = caption;
  }
  const data = await graphPost(`/${igUserId}/media`, params);
  if (!data?.id) {
    throw httpError(502, "Meta no devolvió un id de contenedor de media");
  }
  return data.id;
}

/**
 * Crea el contenedor "padre" de un carrusel de Feed (2-10 imágenes) a partir
 * de los ids de contenedores hijos ya creados con `isCarouselItem: true`.
 */
async function createCarouselContainer({
  igUserId,
  pageAccessToken,
  childrenIds,
  caption = "",
}) {
  const data = await graphPost(`/${igUserId}/media`, {
    media_type: "CAROUSEL",
    children: childrenIds.join(","),
    caption,
    access_token: pageAccessToken,
  });
  if (!data?.id) {
    throw httpError(502, "Meta no devolvió un id de contenedor de carrusel");
  }
  return data.id;
}

/**
 * Crea un contenedor de Historia. Instagram no soporta carrusel para
 * Historias — el caller pasa una sola imagen.
 */
async function createStoryContainer({ igUserId, pageAccessToken, imageUrl }) {
  const data = await graphPost(`/${igUserId}/media`, {
    image_url: imageUrl,
    media_type: "STORIES",
    access_token: pageAccessToken,
  });
  if (!data?.id) {
    throw httpError(502, "Meta no devolvió un id de contenedor de historia");
  }
  return data.id;
}

/**
 * Espera a que un contenedor termine de procesarse (`status_code: FINISHED`)
 * antes de publicarlo — publicar un contenedor `IN_PROGRESS` falla. Poll con
 * intervalo fijo (no hay endpoint de webhook); tope de intentos para no
 * colgar el tick del cron indefinidamente si Meta nunca termina.
 */
async function pollContainerStatus(
  containerId,
  pageAccessToken,
  { maxAttempts = 10, intervalMs = 2000 } = {},
) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const data = await graphGet(`/${containerId}`, {
      fields: "status_code",
      access_token: pageAccessToken,
    });
    if (data?.status_code === "FINISHED") return;
    if (data?.status_code === "ERROR") {
      throw httpError(502, "Instagram no pudo procesar el contenido a publicar");
    }
    if (attempt < maxAttempts - 1) await sleep(intervalMs);
  }
  throw httpError(502, "Instagram tardó demasiado en procesar el contenido");
}

/**
 * Publica un contenedor ya FINISHED. Devuelve el id de la media publicada.
 */
async function publishContainer(containerId, igUserId, pageAccessToken) {
  const data = await graphPost(`/${igUserId}/media_publish`, {
    creation_id: containerId,
    access_token: pageAccessToken,
  });
  if (!data?.id) {
    throw httpError(502, "Meta no devolvió un id de publicación");
  }
  return data.id;
}

/**
 * Resuelve el permalink público de una media ya publicada (para el link
 * "Ver en Instagram" del badge en el feed de Compartidas).
 */
async function fetchPermalink(mediaId, pageAccessToken) {
  const data = await graphGet(`/${mediaId}`, {
    fields: "permalink",
    access_token: pageAccessToken,
  });
  return data?.permalink || "";
}

module.exports = {
  GRAPH_API_VERSION,
  REQUIRED_SCOPES,
  validateAccessToken,
  exchangeLongLivedToken,
  findInstagramPage,
  fetchIgUsername,
  buildCaption,
  createImageContainer,
  createCarouselContainer,
  createStoryContainer,
  pollContainerStatus,
  publishContainer,
  fetchPermalink,
};

// Funciones puras de parsing del XML API2 de BGG. Antes vivían inline
// en routes/bgg.js — acá quedan testeables aislas con fixtures de XML
// real, sin tocar Mongo ni network.
//
// `parser` es la única instancia XMLParser del proyecto — comparte
// settings (preserva attributes con prefix `@_`, no ignora atributos).
//
// Las funciones operan sobre el AST que devuelve `parser.parse(xml)`:
// los nodos de elemento son objetos `{ "@_attr": value, "#text": ...,
// childTag: childAst | [childAst, ...] }`. Cuando una entidad tiene
// uno O muchos children del mismo tipo, fast-xml-parser devuelve un
// objeto o un array — siempre normalizamos con `Array.isArray()` antes
// de map().

const { XMLParser } = require("fast-xml-parser");

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // BGG codifica apóstrofes y otros caracteres especiales como entidades
  // numéricas (`&#039;`, `&#x27;`). `processEntities` (default true) sólo
  // resuelve las "named" como `&amp; &lt; &apos;`; las numéricas requieren
  // `htmlEntities: true`. Sin esto, "Mage Knight: It's a Wonderful Day"
  // llegaba al cliente como "It&#039;s ...". Ver bug del autocomplete BGG.
  htmlEntities: true,
});

// /thing → game shape para el cliente (forma plana, no AST de XML).
function parseGameItem(item) {
  const nameRaw = item.name;
  const nameArr = Array.isArray(nameRaw) ? nameRaw : [nameRaw];
  const primary = nameArr.find((n) => n["@_type"] === "primary") || nameArr[0];
  const thumb =
    typeof item.thumbnail === "string"
      ? item.thumbnail
      : item.thumbnail?.["#text"] || null;
  const img =
    typeof item.image === "string" ? item.image : item.image?.["#text"] || null;
  return {
    id: Number(item["@_id"]),
    name: primary?.["@_value"] || "",
    thumbnail: thumb || null,
    image: img || null,
    year: item.yearpublished?.["@_value"]
      ? Number(item.yearpublished["@_value"])
      : null,
    minPlayers: item.minplayers?.["@_value"]
      ? Number(item.minplayers["@_value"])
      : null,
    maxPlayers: item.maxplayers?.["@_value"]
      ? Number(item.maxplayers["@_value"])
      : null,
    // Tiempo de juego DECLARADO por el editor (de la caja), en minutos. NO es
    // un promedio real de partidas — alimenta la sugerencia de duración al
    // cargar una partida.
    playingTime: item.playingtime?.["@_value"]
      ? Number(item.playingtime["@_value"])
      : null,
    minPlayTime: item.minplaytime?.["@_value"]
      ? Number(item.minplaytime["@_value"])
      : null,
    maxPlayTime: item.maxplaytime?.["@_value"]
      ? Number(item.maxplaytime["@_value"])
      : null,
  };
}

// BggGame doc → game shape (mismo contrato que parseGameItem, para que
// el cliente reciba lo mismo independiente de si vino de Mongo o BGG).
function gameDocToObject(doc) {
  return {
    id: doc.gameId,
    name: doc.name,
    thumbnail: doc.thumbnail,
    image: doc.image,
    year: doc.yearPublished,
    minPlayers: doc.minPlayers,
    maxPlayers: doc.maxPlayers,
    playingTime: doc.playingTime ?? null,
    minPlayTime: doc.minPlayTime ?? null,
    maxPlayTime: doc.maxPlayTime ?? null,
  };
}

// /collection → array de juegos con metadata (rating user, rating BGG,
// numPlays). Devuelve null si el XML no tiene <items> root (señal de
// "user no existe o sin colección").
function parseCollectionXml(xml) {
  const parsed = parser.parse(xml);
  const root = parsed?.items;
  if (!root) return null;
  const rawItems = root.item || [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];
  return items.map((item) => {
    const stats = item.stats || {};
    const rating = stats.rating || {};
    return {
      id: item["@_objectid"],
      name:
        typeof item.name === "object"
          ? (item.name["#text"] ?? item.name["@_sortindex"])
          : item.name,
      thumbnail: item.thumbnail || null,
      image: item.image || null,
      yearPublished: item.yearpublished ? Number(item.yearpublished) : null,
      userRating:
        rating["@_value"] && rating["@_value"] !== "N/A"
          ? Number(rating["@_value"])
          : null,
      bggRating: rating.average?.["@_value"]
        ? Number(rating.average["@_value"])
        : null,
      numPlays: item.numplays ? Number(item.numplays) : 0,
    };
  });
}

// /plays <play> → forma interna usada en BggPlay y para el hash.
// `players` es un array con un orden significativo (reordenar es un
// edit detectable por el probe — memory: feedback-bgg-sync-engine).
function parsePlay(play) {
  const playerNode = play.players?.player;
  const playersArr = playerNode
    ? Array.isArray(playerNode)
      ? playerNode
      : [playerNode]
    : [];
  const commentsRaw = play.comments;
  const comments =
    typeof commentsRaw === "string"
      ? commentsRaw
      : commentsRaw?.["#text"] || null;
  return {
    playId: String(play["@_id"]),
    date: play["@_date"] || null,
    gameName: play.item?.["@_name"] || null,
    gameId: play.item?.["@_objectid"] ? String(play.item["@_objectid"]) : null,
    gameThumbnail: null,
    quantity: play["@_quantity"] ? Number(play["@_quantity"]) : 1,
    duration: play["@_length"] ? Number(play["@_length"]) : null,
    location: play["@_location"] || null,
    incomplete: play["@_incomplete"] === "1" || play["@_incomplete"] === 1,
    nowinstats: play["@_nowinstats"] === "1" || play["@_nowinstats"] === 1,
    comments: comments || null,
    players: playersArr.map((p) => ({
      name: p["@_name"] || null,
      username: p["@_username"] || null,
      userid: p["@_userid"] ? Number(p["@_userid"]) : null,
      position: p["@_startposition"] || null,
      color: p["@_color"] || null,
      score:
        p["@_score"] !== undefined && p["@_score"] !== ""
          ? String(p["@_score"])
          : null,
      win: p["@_win"] === "1" || p["@_win"] === 1,
      new: p["@_new"] === "1" || p["@_new"] === 1,
      rating:
        p["@_rating"] && p["@_rating"] !== "0" ? Number(p["@_rating"]) : null,
    })),
  };
}

// /plays root → { plays, total }. `total` viene del attribute del XML
// (BGG nos dice cuántas hay en total aunque pidamos solo una página).
// Devuelve null si no hay <plays> root — señal de "BGG user not found".
function parsePlaysXml(xml) {
  const parsed = parser.parse(xml);
  const root = parsed?.plays;
  if (!root) return null;
  const rawPlays = root.play || [];
  const arr = Array.isArray(rawPlays) ? rawPlays : [rawPlays];
  return {
    plays: arr.map(parsePlay),
    total: root["@_total"] ? Number(root["@_total"]) : arr.length,
  };
}

// Forma interna (playId) → contrato API (id) usado por el response de
// /partidas y las React keys del cliente. Mantenemos los dos shapes
// porque BggPlay persiste con `playId` y los tests de mutaciones
// comparan por ese campo.
function playToApi(p) {
  return {
    id: p.playId,
    date: p.date,
    gameName: p.gameName,
    gameId: p.gameId,
    gameThumbnail: p.gameThumbnail,
    quantity: p.quantity,
    duration: p.duration,
    location: p.location,
    incomplete: p.incomplete,
    nowinstats: p.nowinstats,
    comments: p.comments,
    players: p.players,
  };
}

// Expansiones de un juego desde el XML del thing: los `link` con
// type="boardgameexpansion" salientes (no inbound = no son "este item es
// expansión de X"). Devuelve [{ id, name }].
function parseGameExpansions(item) {
  if (!item) return [];
  const raw = item.link
    ? Array.isArray(item.link)
      ? item.link
      : [item.link]
    : [];
  return raw
    .filter(
      (l) => l["@_type"] === "boardgameexpansion" && l["@_inbound"] !== "true",
    )
    .map((l) => ({ id: Number(l["@_id"]), name: l["@_value"] || "" }))
    .filter((e) => Number.isFinite(e.id) && e.id > 0 && e.name);
}

module.exports = {
  parser,
  parseGameItem,
  parseGameExpansions,
  gameDocToObject,
  parseCollectionXml,
  parsePlay,
  parsePlaysXml,
  playToApi,
};

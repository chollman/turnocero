import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import axios from "axios";
import { API } from "../api/endpoints";

export const bgWatchKeys = {
  all: ["bgWatch"],
  partidasCooldown: (bggUsername) => [
    ...bgWatchKeys.all,
    "partidasCooldown",
    bggUsername,
  ],
  partidas: (bggUsername, filters) => [
    ...bgWatchKeys.all,
    "partidas",
    bggUsername,
    filters,
  ],
  juegosJugados: (bggUsername) => [
    ...bgWatchKeys.all,
    "juegosJugados",
    bggUsername,
  ],
  resumen: (bggUsername) => [...bgWatchKeys.all, "resumen", bggUsername],
  partidaDetalle: (bggUsername, playId) => [
    ...bgWatchKeys.all,
    "partidaDetalle",
    bggUsername,
    playId,
  ],
  partida: (bggUsername, playId) => [
    ...bgWatchKeys.all,
    "partida",
    bggUsername,
    playId,
  ],
  partidaGrupo: (bggUsername, playId, page) => [
    ...bgWatchKeys.all,
    "partidaGrupo",
    bggUsername,
    playId,
    page,
  ],
  ultimaJuntada: (bggUsername) => [
    ...bgWatchKeys.all,
    "ultimaJuntada",
    bggUsername,
  ],
  misJuegos: (bggUsername, filters) => [
    ...bgWatchKeys.all,
    "misJuegos",
    bggUsername,
    filters,
  ],
  misUbicaciones: (bggUsername, filters) => [
    ...bgWatchKeys.all,
    "misUbicaciones",
    bggUsername,
    filters,
  ],
  misJugadores: (bggUsername, filters) => [
    ...bgWatchKeys.all,
    "misJugadores",
    bggUsername,
    filters,
  ],
  turnoceroJugadores: (filters) => [
    ...bgWatchKeys.all,
    "turnoceroJugadores",
    filters,
  ],
  jugadores: (bggUsername, filters) => [
    ...bgWatchKeys.all,
    "jugadores",
    bggUsername,
    filters,
  ],
  jugadorDetalle: (bggUsername, key, page) => [
    ...bgWatchKeys.all,
    "jugadorDetalle",
    bggUsername,
    key,
    page,
  ],
  ubicaciones: (bggUsername, filters) => [
    ...bgWatchKeys.all,
    "ubicaciones",
    bggUsername,
    filters,
  ],
  ubicacionDetalle: (bggUsername, key, page) => [
    ...bgWatchKeys.all,
    "ubicacionDetalle",
    bggUsername,
    key,
    page,
  ],
  variantes: (bggUsername, gameId) => [
    ...bgWatchKeys.all,
    "variantes",
    bggUsername,
    gameId,
  ],
  gameExpansiones: (gameId) => [...bgWatchKeys.all, "gameExpansiones", gameId],
  usernamesMap: (usernamesKey) => [
    ...bgWatchKeys.all,
    "usernamesMap",
    usernamesKey,
  ],
  comunidadJuegos: (periodo) => [...bgWatchKeys.all, "comunidadJuegos", periodo],
  comunidadJuego: (gameId) => [...bgWatchKeys.all, "comunidadJuego", gameId],
  comunidadJugadores: (metric) => [
    ...bgWatchKeys.all,
    "comunidadJugadores",
    metric,
  ],
  comunidadH2H: (userA, userB) => [
    ...bgWatchKeys.all,
    "comunidadH2H",
    userA,
    userB,
  ],
  comunidadActividad: () => [...bgWatchKeys.all, "comunidadActividad"],
  comunidadHeatmap: () => [...bgWatchKeys.all, "comunidadHeatmap"],
  comunidadRank: (bggUsername, gameId) => [
    ...bgWatchKeys.all,
    "comunidadRank",
    bggUsername,
    gameId,
  ],
  quickStats: (bggUsername, includeExtra) => [
    ...bgWatchKeys.all,
    "quickStats",
    bggUsername,
    includeExtra,
  ],
};

// ── Quick stats (widget "Mi BG Watch" / tarjeta BG Watch en perfil público) ──
// Total de partidas + tamaño de colección, con top-juego y fecha de última
// partida opcionales (`includeExtra`). Antes vivía duplicado como un fetch
// manual en MiBgWatchCard.jsx y BgWatchUserCard.jsx (pages/users) — mismo par
// de GET, dos formas de estado distintas. `partidas`/`coleccion` se resuelven
// en paralelo y cada una absorbe su propio error a `null` (igual que el
// código viejo): un fallo parcial no tira la card entera, solo esa mitad del
// dato — `ok:false` en el resultado indica que AMBAS fallaron.
export function useBgWatchQuickStatsQuery(
  bggUsername,
  { includeExtra = false } = {},
) {
  return useQuery({
    queryKey: bgWatchKeys.quickStats(bggUsername, includeExtra),
    queryFn: async ({ signal }) => {
      const [partidas, coleccion] = await Promise.all([
        axios
          .get(API.bgg.PARTIDAS(bggUsername), { params: { page: 1 }, signal })
          .then((r) => r.data)
          .catch(() => null),
        axios
          .get(API.bgg.COLECCION(bggUsername), { signal })
          .then((r) => r.data)
          .catch(() => null),
      ]);
      const result = {
        partidas: partidas?.total ?? null,
        juegos: Array.isArray(coleccion) ? coleccion.length : null,
        ok: partidas !== null || coleccion !== null,
      };
      if (includeExtra) {
        // Preferimos el top-juego agregado por el server (BggPlay). Si no
        // vino (perfil sin sincronizar), lo derivamos de numPlays de la
        // colección — no cubre juegos no poseídos ni colecciones privadas.
        let topGame = partidas?.topGame ?? null;
        if (!topGame && Array.isArray(coleccion) && coleccion.length > 0) {
          const sorted = [...coleccion]
            .filter((g) => g.numPlays > 0)
            .sort((a, b) => b.numPlays - a.numPlays);
          topGame = sorted[0] || null;
        }
        result.lastDate = partidas?.plays?.[0]?.date ?? null;
        result.topGame = topGame;
      }
      return result;
    },
    enabled: !!bggUsername,
  });
}

// ── Partidas (lista + agregados de perfil) ──────────────────────────────

// Lee el header de cooldown del refresh manual, en la respuesta OK o en el
// error 429 — mismo formato en /partidas y /coleccion (ver refresh* abajo).
function readCooldownMs(headers) {
  return Number(headers?.["x-refresh-cooldown-ms"] || 0);
}

async function fetchPartidas(bggUsername, params, signal) {
  try {
    const { data, headers } = await axios.get(API.bgg.PARTIDAS(bggUsername), {
      params,
      signal,
    });
    return { data, cooldownMs: readCooldownMs(headers) };
  } catch (err) {
    err.cooldownMs = readCooldownMs(err.response?.headers);
    throw err;
  }
}

// Query key normalizado, compartido entre el hook de lectura y
// `refreshBgWatchPartidas` (que escribe el resultado del refresh manual
// directo a esta MISMA entrada de cache vía `queryClient.setQueryData`).
export const partidasQueryKey = (bggUsername, { page = 1, mindate, maxdate, gameId } = {}) =>
  bgWatchKeys.partidas(bggUsername, {
    page,
    mindate: mindate || null,
    maxdate: maxdate || null,
    gameId: gameId || null,
  });

// Lista paginada (page-number, no infinite) de partidas del perfil. Sirve
// tanto al modo lista (PartidasPanel) como a la vista por-juego
// (BgWatchPerGameView, filtro `gameId`). Cada GET (no solo el refresh manual)
// carga el cooldown server-enforced — se stashea en un cache-entry propio
// (`partidasCooldown`) para que PartidasPanel sincronice su cuenta regresiva
// también en la carga inicial, no solo tras un click en "Actualizar".
export function useBgWatchPartidasQuery({
  bggUsername,
  page = 1,
  mindate,
  maxdate,
  gameId,
  enabled = true,
}) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: partidasQueryKey(bggUsername, { page, mindate, maxdate, gameId }),
    queryFn: async ({ signal }) => {
      const params = { page };
      if (mindate) params.mindate = mindate;
      if (maxdate) params.maxdate = maxdate;
      if (gameId) params.id = gameId;
      const { data, cooldownMs } = await fetchPartidas(bggUsername, params, signal);
      queryClient.setQueryData(
        bgWatchKeys.partidasCooldown(bggUsername),
        cooldownMs > 0 ? Date.now() + cooldownMs : 0,
      );
      return data;
    },
    enabled: enabled && !!bggUsername,
  });
}

// Cache-only companion of `useBgWatchPartidasQuery` — never fetches on its
// own; populated as a side effect of that query's queryFn and by the manual
// refresh caller.
export function usePartidasCooldownQuery(bggUsername) {
  return useQuery({
    queryKey: bgWatchKeys.partidasCooldown(bggUsername),
    queryFn: () => 0,
    enabled: false,
    initialData: 0,
  });
}

// "Actualizar" manual — bypassea la cache del server (`refresh:1`) y devuelve
// el cooldown para que el caller arme la cuenta regresiva. El caller escribe
// el resultado en el cache con `queryClient.setQueryData`.
export const refreshBgWatchPartidas = (bggUsername, { page, mindate, maxdate } = {}) => {
  const params = { page, refresh: 1 };
  if (mindate) params.mindate = mindate;
  if (maxdate) params.maxdate = maxdate;
  return fetchPartidas(bggUsername, params);
};

export function useJuegosJugadosQuery(bggUsername, { enabled = true } = {}) {
  return useQuery({
    queryKey: bgWatchKeys.juegosJugados(bggUsername),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.bgg.JUEGOS_JUGADOS(bggUsername), {
        signal,
      });
      return data;
    },
    enabled: enabled && !!bggUsername,
  });
}

export function useResumenQuery(bggUsername, { enabled = true } = {}) {
  return useQuery({
    queryKey: bgWatchKeys.resumen(bggUsername),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.bgg.RESUMEN(bggUsername), {
        signal,
      });
      return data;
    },
    enabled: enabled && !!bggUsername,
  });
}

// ── Partida individual ───────────────────────────────────────────────────

export function usePartidaDetalleQuery(bggUsername, playId) {
  return useQuery({
    queryKey: bgWatchKeys.partidaDetalle(bggUsername, playId),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(
        API.bgg.PARTIDA_DETALLE(bggUsername, playId),
        { signal },
      );
      return data;
    },
    enabled: !!bggUsername && !!playId,
    retry: false,
  });
}

// Fallback de EditPlay cuando la partida no vino por location.state.
export function usePartidaQuery(bggUsername, playId, { enabled = true } = {}) {
  return useQuery({
    queryKey: bgWatchKeys.partida(bggUsername, playId),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.bgg.PARTIDA(bggUsername, playId), {
        signal,
      });
      return data;
    },
    enabled: enabled && !!bggUsername && !!playId,
    retry: false,
  });
}

// "Con este grupo" — carga perezosa, solo al primer despliegue.
export function usePartidaGrupoQuery(
  bggUsername,
  playId,
  page,
  { enabled = true } = {},
) {
  return useQuery({
    queryKey: bgWatchKeys.partidaGrupo(bggUsername, playId, page),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(
        API.bgg.PARTIDA_GRUPO(bggUsername, playId),
        { params: { page }, signal },
      );
      return data;
    },
    enabled: enabled && !!bggUsername && !!playId,
  });
}

export function useUltimaJuntadaQuery(bggUsername, { enabled = true } = {}) {
  return useQuery({
    queryKey: bgWatchKeys.ultimaJuntada(bggUsername),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.bgg.ULTIMA_JUNTADA(bggUsername), {
        signal,
      });
      return data.juntada || null;
    },
    enabled: enabled && !!bggUsername,
  });
}

// ── Pickers de PlayForm (búsqueda + infinite scroll) ────────────────────

export function useMisJuegosQuery({ bggUsername, page = 1, q, enabled = true }) {
  return useInfiniteQuery({
    queryKey: bgWatchKeys.misJuegos(bggUsername, { q: q || "" }),
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await axios.get(API.bgg.MIS_JUEGOS(bggUsername), {
        params: { page: pageParam, q: q || undefined },
        signal,
      });
      return data;
    },
    initialPageParam: page,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
    enabled: enabled && !!bggUsername,
  });
}

export function useMisUbicacionesQuery({
  bggUsername,
  q,
  enabled = true,
}) {
  return useInfiniteQuery({
    queryKey: bgWatchKeys.misUbicaciones(bggUsername, { q: q || "" }),
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await axios.get(API.bgg.MIS_UBICACIONES(bggUsername), {
        params: { page: pageParam, q: q || undefined },
        signal,
      });
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
    enabled: enabled && !!bggUsername,
  });
}

export function useMisJugadoresQuery({ bggUsername, q, enabled = true }) {
  return useInfiniteQuery({
    queryKey: bgWatchKeys.misJugadores(bggUsername, { q: q || "" }),
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await axios.get(API.bgg.MIS_JUGADORES(bggUsername), {
        params: { page: pageParam, q: q || undefined },
        signal,
      });
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
    enabled: enabled && !!bggUsername,
  });
}

// Modo "turnocero" de PlayerPicker — busca usuarios de TurnoCero, no
// compañeros derivados de BggPlay.
export function useTurnoceroJugadoresQuery({ q, enabled = true }) {
  return useInfiniteQuery({
    queryKey: bgWatchKeys.turnoceroJugadores({ q: q || "" }),
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await axios.get(API.users.JUGADORES, {
        params: { page: pageParam, q: q || undefined },
        signal,
      });
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
    enabled,
  });
}

export function useVariantesQuery(bggUsername, gameId, { enabled = true } = {}) {
  return useQuery({
    queryKey: bgWatchKeys.variantes(bggUsername, gameId),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(
        API.bgg.VARIANTES(bggUsername, gameId),
        { signal },
      );
      return data.items || [];
    },
    enabled: enabled && !!bggUsername && !!gameId,
  });
}

export function useGameExpansionesQuery(gameId, { enabled = true } = {}) {
  return useQuery({
    queryKey: bgWatchKeys.gameExpansiones(gameId),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.bgg.GAME_EXPANSIONES(gameId), {
        signal,
      });
      return data.items || [];
    },
    enabled: enabled && !!gameId,
  });
}

// ── Jugadores / Ubicaciones (paneles, page-number) ──────────────────────

export function useJugadoresQuery({ bggUsername, page = 1, q, enabled = true }) {
  return useQuery({
    queryKey: bgWatchKeys.jugadores(bggUsername, { page, q: q || "" }),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.bgg.JUGADORES(bggUsername), {
        params: { page, q: q || undefined },
        signal,
      });
      return data;
    },
    enabled: enabled && !!bggUsername,
  });
}

// Búsqueda de fusión (MergePlayerModal) — mismo endpoint, sin paginar
// (limit:50 fijo), key propia para no pisar la cache paginada del panel.
export function useJugadoresMergeSearchQuery({ bggUsername, q, enabled = true }) {
  return useQuery({
    queryKey: [...bgWatchKeys.jugadores(bggUsername, { merge: true }), q || ""],
    queryFn: async () => {
      const { data } = await axios.get(API.bgg.JUGADORES(bggUsername), {
        params: { q: q || undefined, limit: 50 },
      });
      return data.items || [];
    },
    enabled: enabled && !!bggUsername,
  });
}

export function useJugadorDetalleQuery(bggUsername, playerKey, page, { enabled = true } = {}) {
  return useQuery({
    queryKey: bgWatchKeys.jugadorDetalle(bggUsername, playerKey, page),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(
        API.bgg.JUGADOR_DETALLE(bggUsername, playerKey),
        { params: { page }, signal },
      );
      return data;
    },
    enabled: enabled && !!bggUsername && !!playerKey,
  });
}

export function useUbicacionesQuery({ bggUsername, page = 1, q, enabled = true }) {
  return useQuery({
    queryKey: bgWatchKeys.ubicaciones(bggUsername, { page, q: q || "" }),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.bgg.UBICACIONES(bggUsername), {
        params: { page, q: q || undefined },
        signal,
      });
      return data;
    },
    enabled: enabled && !!bggUsername,
  });
}

export function useUbicacionesMergeSearchQuery({ bggUsername, q, enabled = true }) {
  return useQuery({
    queryKey: [...bgWatchKeys.ubicaciones(bggUsername, { merge: true }), q || ""],
    queryFn: async () => {
      const { data } = await axios.get(API.bgg.UBICACIONES(bggUsername), {
        params: { q: q || undefined, limit: 50 },
      });
      return data.items || [];
    },
    enabled: enabled && !!bggUsername,
  });
}

export function useUbicacionDetalleQuery(bggUsername, locationKey, page, { enabled = true } = {}) {
  return useQuery({
    queryKey: bgWatchKeys.ubicacionDetalle(bggUsername, locationKey, page),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(
        API.bgg.UBICACION_DETALLE(bggUsername, locationKey),
        { params: { page }, signal },
      );
      return data;
    },
    enabled: enabled && !!bggUsername && !!locationKey,
  });
}

// ── Mapa bggUsername → usuario TurnoCero (batch, deduped) ───────────────

// Chunkea en batches de 50 (límite del endpoint) y mergea los resultados.
// Compartido por useBggUserMap (deriva usernames de una lista de plays) y por
// cualquier caller que ya tenga una lista cruda de usernames (PlayerPicker).
export function useBggUsernamesMapQuery(usernames) {
  const usernamesKey = useMemo(
    () => (usernames || []).slice().sort().join(","),
    [usernames],
  );
  return useQuery({
    queryKey: bgWatchKeys.usernamesMap(usernamesKey),
    queryFn: async () => {
      const chunks = [];
      for (let i = 0; i < usernames.length; i += 50) {
        chunks.push(usernames.slice(i, i + 50));
      }
      const results = await Promise.all(
        chunks.map((c) =>
          axios
            .post(API.users.BY_BGG_USERNAMES, { usernames: c })
            .then((r) => r.data)
            .catch(() => []),
        ),
      );
      const map = {};
      for (const arr of results) {
        if (!Array.isArray(arr)) continue;
        for (const u of arr) {
          if (u.bggUsername) map[u.bggUsername.toLowerCase()] = u;
        }
      }
      return map;
    },
    enabled: usernames.length > 0,
    staleTime: 5 * 60_000,
  });
}

// ── Comunidad ─────────────────────────────────────────────────────────────

export function useComunidadJuegosQuery(periodo) {
  return useQuery({
    queryKey: bgWatchKeys.comunidadJuegos(periodo),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.bgg.COMUNIDAD_JUEGOS, {
        params: { periodo },
        signal,
      });
      return data.games || [];
    },
  });
}

export function useComunidadJuegoQuery(gameId) {
  return useQuery({
    queryKey: bgWatchKeys.comunidadJuego(gameId),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.bgg.COMUNIDAD_JUEGO(gameId), {
        signal,
      });
      return data;
    },
    enabled: !!gameId,
    retry: false,
  });
}

export function useComunidadJugadoresQuery(metric) {
  return useQuery({
    queryKey: bgWatchKeys.comunidadJugadores(metric),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.bgg.COMUNIDAD_JUGADORES, {
        params: { metric },
        signal,
      });
      return data.players || [];
    },
  });
}

export function useComunidadH2HQuery(userA, userB) {
  return useQuery({
    queryKey: bgWatchKeys.comunidadH2H(userA, userB),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.bgg.COMUNIDAD_H2H(userA, userB), {
        signal,
      });
      return data;
    },
    enabled: !!userA && !!userB,
    retry: false,
  });
}

export function useComunidadActividadQuery() {
  return useInfiniteQuery({
    queryKey: bgWatchKeys.comunidadActividad(),
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await axios.get(API.bgg.COMUNIDAD_ACTIVIDAD, {
        params: { page: pageParam, limit: 20 },
        signal,
      });
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
  });
}

export function useComunidadHeatmapQuery() {
  return useQuery({
    queryKey: bgWatchKeys.comunidadHeatmap(),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.bgg.COMUNIDAD_HEATMAP, { signal });
      return data.heatmap || [];
    },
  });
}

export function useComunidadRankQuery(bggUsername, gameId, { enabled = true } = {}) {
  return useQuery({
    queryKey: bgWatchKeys.comunidadRank(bggUsername, gameId),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(
        API.bgg.COMUNIDAD_RANK(bggUsername, gameId),
        { signal },
      );
      return data.rank || null;
    },
    enabled: enabled && !!bggUsername && !!gameId,
  });
}

// ── Writes ─────────────────────────────────────────────────────────────
// Funciones planas (no useMutation) — cada caller maneja su propio
// busy/error local, mismo criterio que Fases 2-6.

export const createBgWatchPlay = (payload) =>
  axios.post(API.bgg.PARTIDAS_LIST, payload);
export const updateBgWatchPlay = (playId, payload) =>
  axios.put(API.bgg.PARTIDA_DETAIL(playId), payload);
export const deleteBgWatchPlay = (playId) =>
  axios.delete(API.bgg.PARTIDA_DETAIL(playId));

// Auto-detección de "jugador nuevo" mientras se arma el roster — no es una
// query cacheable (cambia con cada edición del form), así que queda como un
// simple helper axios-backed en vez de un hook de query.
export const detectNewPlayers = (bggUsername, gameId, players, signal) =>
  axios.post(
    API.bgg.NUEVOS(bggUsername, gameId),
    { players },
    { signal },
  );

export const renamePlayer = (bggUsername, rawKeys, name) =>
  axios.patch(API.bgg.JUGADOR_NOMBRE(bggUsername), { rawKeys, name });
export const relinkPlayerBgg = (bggUsername, rawKeys, bggUsernameHandle) =>
  axios.patch(API.bgg.JUGADOR_BGG(bggUsername), {
    rawKeys,
    bggUsername: bggUsernameHandle,
  });
export const uploadPlayerAvatar = (bggUsername, formData) =>
  axios.put(API.bgg.JUGADOR_AVATAR(bggUsername), formData);
export const removePlayerAvatar = (bggUsername, rawKeys) =>
  axios.delete(API.bgg.JUGADOR_AVATAR(bggUsername), { data: { rawKeys } });
export const markPlayerSelf = (bggUsername, rawKeys, value) =>
  axios.post(API.bgg.JUGADOR_YO_MISMO(bggUsername), { rawKeys, value });
export const mergePlayers = (bggUsername, sourceRawKeys, targetRawKeys) =>
  axios.post(API.bgg.JUGADOR_MERGE(bggUsername), {
    sourceRawKeys,
    targetRawKeys,
  });

export const renameLocation = (bggUsername, rawKeys, name) =>
  axios.patch(API.bgg.UBICACION_NOMBRE(bggUsername), { rawKeys, name });
export const mergeLocations = (bggUsername, sourceRawKeys, targetRawKeys) =>
  axios.post(API.bgg.UBICACION_MERGE(bggUsername), {
    sourceRawKeys,
    targetRawKeys,
  });

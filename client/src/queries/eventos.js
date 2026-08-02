import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API } from "../api/endpoints";

const PAGE_SIZE = 12;

export const eventoKeys = {
  all: ["eventos"],
  lists: () => [...eventoKeys.all, "list"],
  list: (filters) => [...eventoKeys.lists(), filters],
  details: () => [...eventoKeys.all, "detail"],
  detail: (id) => [...eventoKeys.details(), id],
  inscripciones: (id) => [...eventoKeys.detail(id), "inscripciones"],
  ludoteca: (id) => [...eventoKeys.detail(id), "ludoteca"],
  mesas: (id) => [...eventoKeys.detail(id), "mesas"],
};

// ── Reads ──────────────────────────────────────────────────────────────

// Portada /eventos: "cargar más" acumula páginas por combinación de
// status/radio/búsqueda. `status` ya viene resuelto por el caller (Eventos.jsx
// mapea el chip de filtro activo a un status del server o null — "all"/"mine"
// no filtran server-side).
export function useEventosQuery({ status, radiusKm, search } = {}) {
  return useInfiniteQuery({
    queryKey: eventoKeys.list({
      status: status || null,
      radiusKm: radiusKm || 0,
      search: search?.trim() || "",
    }),
    queryFn: async ({ pageParam, signal }) => {
      const params = { page: pageParam, limit: PAGE_SIZE };
      if (status) params.status = status;
      if (radiusKm > 0) params.maxDistanceKm = radiusKm;
      if (search?.trim()) params.search = search.trim();
      const { data } = await axios.get(API.eventos.LIST, { params, signal });
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
  });
}

export function useEventoQuery(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: eventoKeys.detail(id),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.eventos.DETAIL(id), { signal });
      return data;
    },
    enabled: enabled && !!id,
  });
}

// Mesas del evento — fetch real separado del detail (el server no lo embebe
// en GET /eventos/:id). EventoMesas.jsx sigue recibiendo items/setItems por
// prop tal cual, así que este hook solo lo usa EventoDetail.jsx.
export function useEventoMesasQuery(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: eventoKeys.mesas(id),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.eventos.MESAS(id), { signal });
      return data.tables || [];
    },
    enabled: enabled && !!id,
  });
}

// Cache-only (mismo patrón que TableChat/notifications — ver Fases 3/5/6):
// el server embebe `ludoteca` en el GET /eventos/:id, así que no hay un GET
// idempotente propio que fetchear acá — EventoDetail siembra esta cache con
// `evento.ludoteca` al bootear y el socket + las mutaciones locales la
// mantienen al día después.
export function useEventoLudotecaQuery(id) {
  return useQuery({
    queryKey: eventoKeys.ludoteca(id),
    queryFn: () => [],
    enabled: false,
  });
}

export function useEventoInscripcionesQuery(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: eventoKeys.inscripciones(id),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.eventos.INSCRIPCIONES(id), {
        signal,
      });
      return data;
    },
    enabled: enabled && !!id,
  });
}

// ── Writes ─────────────────────────────────────────────────────────────
// Funciones planas (no useMutation) — mismo criterio que mesas/torneos.

export const createEvento = (formData) =>
  axios.post(API.eventos.LIST, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const updateEvento = (id, formData) =>
  axios.put(API.eventos.DETAIL(id), formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const inscribirseEvento = (id, formData) =>
  axios.post(API.eventos.INSCRIBIRSE(id), formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const cancelarInscripcion = (id) =>
  axios.delete(API.eventos.INSCRIBIRSE(id));

export const confirmarInscripcion = (id, userId, adminNotes) =>
  axios.patch(API.eventos.INSCRIPCION_CONFIRMAR(id, userId), { adminNotes });
export const rechazarInscripcion = (id, userId, adminNotes, permanent) =>
  axios.patch(API.eventos.INSCRIPCION_RECHAZAR(id, userId), {
    adminNotes,
    permanent,
  });
export const revertirInscripcion = (id, userId) =>
  axios.patch(API.eventos.INSCRIPCION_REVERTIR(id, userId));

export const addLudotecaItem = (id, payload) =>
  axios.post(API.eventos.LUDOTECA(id), payload);
export const removeLudotecaItem = (id, itemId) =>
  axios.delete(API.eventos.LUDOTECA_ITEM(id, itemId));

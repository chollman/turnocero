import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import axios from "axios";
import { API } from "../api/endpoints";

const PAGE_SIZE = 10;

const noticiasKeys = {
  all: ["noticias"],
  lists: () => [...noticiasKeys.all, "list"],
  list: (filters) => [...noticiasKeys.lists(), filters],
  related: (filters) => [...noticiasKeys.lists(), "related", filters],
  details: () => [...noticiasKeys.all, "detail"],
  detail: (id) => [...noticiasKeys.details(), id],
};

// Portada: carga incremental por categoría+búsqueda ("Cargar más" acumula
// páginas), reemplaza el useState+useEffect+axios manual de Noticias.jsx.
export function useNoticiasQuery({ category, search } = {}) {
  return useInfiniteQuery({
    queryKey: noticiasKeys.list({
      category: category && category !== "all" ? category : "all",
      search: search?.trim() || "",
    }),
    queryFn: async ({ pageParam, signal }) => {
      const params = { page: pageParam, limit: PAGE_SIZE };
      if (category && category !== "all") params.category = category;
      if (search?.trim()) params.search = search.trim();
      const { data } = await axios.get(API.noticias.LIST, { params, signal });
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
  });
}

export function useNoticiaQuery(id) {
  return useQuery({
    queryKey: noticiasKeys.detail(id),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.noticias.DETAIL(id), { signal });
      return data;
    },
    enabled: !!id,
  });
}

// "Seguí leyendo": otras noticias, misma categoría primero. Depende del
// resultado de useNoticiaQuery (category + excludeId), así que el caller la
// habilita recién cuando esa query resuelve.
export function useRelatedNoticiasQuery({ category, excludeId, enabled }) {
  return useQuery({
    queryKey: noticiasKeys.related({ category: category || null, excludeId }),
    queryFn: async ({ signal }) => {
      const params = { limit: 6 };
      if (category && category !== "general") params.category = category;
      const { data } = await axios.get(API.noticias.LIST, {
        params,
        signal,
      });
      return (data.noticias || [])
        .filter((n) => n._id !== excludeId)
        .slice(0, 2);
    },
    enabled: enabled && !!excludeId,
  });
}

function invalidateNoticias(queryClient) {
  return queryClient.invalidateQueries({ queryKey: noticiasKeys.all });
}

export function useCreateNoticiaMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData) => {
      const { data } = await axios.post(API.noticias.CREATE, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => invalidateNoticias(queryClient),
  });
}

export function useUpdateNoticiaMutation(id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData) => {
      const { data } = await axios.put(API.noticias.UPDATE(id), formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => invalidateNoticias(queryClient),
  });
}

export function useDeleteNoticiaMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      await axios.delete(API.noticias.DELETE(id));
      return id;
    },
    onSuccess: () => invalidateNoticias(queryClient),
  });
}

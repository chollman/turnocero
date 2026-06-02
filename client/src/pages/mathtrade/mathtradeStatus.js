// Metadata de estados de un Math Trade (label español + token de color de
// marca). Usado por las cards, el detalle y el panel de admin.
export const STATUS_META = {
  draft: { label: "Borrador", color: "--text-muted" },
  open: { label: "Inscripción abierta", color: "--green" },
  locked: { label: "Inscripción cerrada", color: "--orange" },
  results: { label: "Resultados publicados", color: "--amber" },
  finished: { label: "Finalizado", color: "--purple" },
  cancelled: { label: "Cancelado", color: "--red" },
};

export const getStatusMeta = (status) =>
  STATUS_META[status] || STATUS_META.draft;

export const MODE_LABEL = {
  max: "Cadena máxima",
  bounded: "Cadena acotada",
  auto: "Automática",
};

export const getModeLabel = (mode) => MODE_LABEL[mode] || MODE_LABEL.max;

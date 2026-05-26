// Mapeo único para los 4 estados de un Evento. Antes vivía duplicado en
// PosterCard, TimelineRow y EventoForm, con riesgo de desincronizar labels.

// Para chips/badges (PosterCard, TimelineRow). `className` se usa como sufijo
// del CSS Module local: `styles[`status_${badge.className}`]`.
export const EVENTO_STATUS_BADGES = {
  open: { label: "Abierto", className: "open" },
  draft: { label: "Borrador", className: "draft" },
  closed: { label: "Cerrado", className: "closed" },
  cancelled: { label: "Cancelado", className: "cancelled" },
};

// Para selectores en formularios (EventoForm), array ordenado con descripción.
export const EVENTO_STATUS_OPTIONS = [
  {
    value: "draft",
    label: "Borrador",
    description: "No visible para los usuarios",
  },
  { value: "open", label: "Abierto", description: "Inscripciones habilitadas" },
  { value: "closed", label: "Cerrado", description: "Sin inscripciones" },
  { value: "cancelled", label: "Cancelado", description: "Evento cancelado" },
];

export function getEventoStatusBadge(status) {
  return EVENTO_STATUS_BADGES[status] || null;
}

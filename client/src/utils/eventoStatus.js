// Mapeo único para los 4 estados de un Evento. Antes vivía duplicado en
// PosterCard, TimelineRow y EventoForm, con riesgo de desincronizar labels.
//
// Los labels/descriptions salen por i18n vía GETTERS (no constantes) porque el
// idioma puede cambiar en runtime con el toggle de /perfil; una constante a
// module-load congelaría el idioma. Los campos estructurales (`className`,
// `value`) quedan como JS plano.
import i18n from "../i18n";

// Para chips/badges (PosterCard, TimelineRow). `className` se usa como sufijo
// del CSS Module local: `styles[`status_${badge.className}`]`.
export function getEventoStatusBadges() {
  return {
    open: { label: i18n.t("enums:eventoStatus.badges.open"), className: "open" },
    draft: {
      label: i18n.t("enums:eventoStatus.badges.draft"),
      className: "draft",
    },
    closed: {
      label: i18n.t("enums:eventoStatus.badges.closed"),
      className: "closed",
    },
    cancelled: {
      label: i18n.t("enums:eventoStatus.badges.cancelled"),
      className: "cancelled",
    },
  };
}

// Para selectores en formularios (EventoForm), array ordenado con descripción.
export function getEventoStatusOptions() {
  return [
    {
      value: "draft",
      label: i18n.t("enums:eventoStatus.options.draft.label"),
      description: i18n.t("enums:eventoStatus.options.draft.description"),
    },
    {
      value: "open",
      label: i18n.t("enums:eventoStatus.options.open.label"),
      description: i18n.t("enums:eventoStatus.options.open.description"),
    },
    {
      value: "closed",
      label: i18n.t("enums:eventoStatus.options.closed.label"),
      description: i18n.t("enums:eventoStatus.options.closed.description"),
    },
    {
      value: "cancelled",
      label: i18n.t("enums:eventoStatus.options.cancelled.label"),
      description: i18n.t("enums:eventoStatus.options.cancelled.description"),
    },
  ];
}

export function getEventoStatusBadge(status) {
  return getEventoStatusBadges()[status] || null;
}

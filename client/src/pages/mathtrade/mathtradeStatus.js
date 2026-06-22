// Metadata de estados de un Math Trade (label + token de color de marca). Usado
// por las cards, el detalle y el panel de admin.
//
// Los labels salen por i18n vía GETTERS (no constantes) porque el idioma puede
// cambiar en runtime con el toggle de /perfil; una constante a module-load
// congelaría el idioma. El `color` (token estructural) queda como JS plano.
import i18n from "../../i18n";

const STATUS_COLOR = {
  draft: "--text-muted",
  open: "--green",
  locked: "--orange",
  results: "--amber",
  finished: "--purple",
  cancelled: "--red",
};

export const getStatusMeta = (status) => {
  const key = STATUS_COLOR[status] ? status : "draft";
  return {
    label: i18n.t(`mathtrade:status.${key}`),
    color: STATUS_COLOR[key],
  };
};

export const getModeLabel = (mode) => {
  const key = ["max", "bounded", "auto"].includes(mode) ? mode : "max";
  return i18n.t(`mathtrade:mode.${key}`);
};

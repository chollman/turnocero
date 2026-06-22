// Frases con humor tablero-argento que se muestran (al azar) en el widget
// intercalado del feed de Compartidas. Una se elige por visita a la sección.
// El texto vive en i18n (namespace `quotes`, key `compartida`) y se resuelve
// vía el singleton global; es un getter porque el idioma cambia en runtime.
import i18n from "../i18n";

export const getCompartidaQuotes = () =>
  i18n.t("quotes:compartida", { returnObjects: true });

// Devuelve una frase al azar del listado.
export function randomCompartidaQuote() {
  const quotes = getCompartidaQuotes();
  const i = Math.floor(Math.random() * quotes.length);
  return quotes[i];
}

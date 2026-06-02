// Metadata de los tres tipos de item que agrega el Calendario. Fuente única
// para label, sección de SiteConfig que lo gobierna, y la clase CSS del color.
// Color por tipo (tokens en index.css): mesa=amber, evento=green, torneo=purple.

export const TIPO_META = {
  mesa: { label: "Mesa", section: "mesas", cls: "tipoMesa" },
  evento: { label: "Evento", section: "eventos", cls: "tipoEvento" },
  torneo: { label: "Torneo", section: "torneos", cls: "tipoTorneo" },
};

export const TIPO_ORDER = ["mesa", "evento", "torneo"];

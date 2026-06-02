// Frases con humor tablero-argento que se muestran (al azar) en el widget
// intercalado del feed de Compartidas. Una se elige por visita a la sección.
export const COMPARTIDA_QUOTES = [
  "Comprar juegos de mesa y tener tiempo para jugarlos son dos hobbys totalmente distintos, no me rompan el corazón.",
  "Mi cabeza dice: 'No te entra un tablero más en el mueble'. Mi corazón dice: 'Si ordenás las cajas en vertical, metemos el Kickstarter que llega el mes que viene'.",
  "Madurar es pasar de: '¿Qué boliche abre hoy?' a: '¿Quién se lee el manual de 40 páginas y nos lo explica en cinco minutos?'.",
  "No tengo el living hecho un quilombo, estoy desplegando un juego Big Box. Es arte, no lo entenderías.",
  "Los amigos van y vienen, pero los puntos de victoria te quedan en el alma para toda la vida.",
  "No sabés lo que es la traición hasta que tu mejor amigo te roba el último recurso en la última ronda. Ahí se termina la diplomacia.",
  "Un juego cooperativo es ese lugar hermoso donde podemos perder todos juntos y echarle la culpa al mismo colgado de siempre.",
  "Te quiero un montón, en serio, pero si te me cruzás en el tablero te voy a pasar por arriba sin culpa.",
  "Mito urbano: una vez un eurogamer jugó su turno en menos de cinco minutos sin pedir que nadie le recalcule las reglas.",
  "El tiempo es relativo. Un minuto esperando el colectivo es eterno; un minuto pensando tu jugada es una falta de respeto al resto de la mesa. ¡Dale, che!",
  "Te lo pido por favor, mové la ficha ya. Mis nietos necesitan heredar esta mesa en algún momento del siglo.",
  "No estoy colgado, estoy calculando las próximas 47 variables de la partida. Dejame craneando tranquilo.",
  "Yo no tengo mala suerte con los dados, son ellos que no tienen la más puta idea de lo que es la alta estrategia.",
  "El azar no existe. Son los dados que me agarraron de punto desde que arrancó la noche.",
  "La peor frase del universo: 'Es solo un juego, che', cuando te ganaron la partida por un miserable punto de victoria.",
  "Si la vida te da limones... fijate si cotizan bien en la fase de comercio o si se los podés encajar a otro.",
  "La vida es corta, clavale el turno extra y que Dios te ayude.",
  "No soy adicto a los juegos de mesa. Solo tengo un romance muy intenso y costoso con el cartón, el plástico y el olor a nuevo.",
  "Detrás de cada gran jugador de mesa... hay una montaña de fundas para cartas tiradas y mil bolsitas zip que no se sabe de dónde salieron.",
  "En esta web no vendemos juegos, vendemos la excusa perfecta para clavarle el visto al celular por tres horas y vernos las caras.",
];

// Devuelve una frase al azar del listado.
export function randomCompartidaQuote() {
  const i = Math.floor(Math.random() * COMPARTIDA_QUOTES.length);
  return COMPARTIDA_QUOTES[i];
}

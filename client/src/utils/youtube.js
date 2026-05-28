// Utilities para identificar / parsear videos de YouTube.
//
// Usado por:
//  - MesaForm (Paso 5 — Tutoriales) — el host pega un URL y necesitamos
//    extraer el videoId para enviarlo al server.
//  - TableTutorials — reconstruye el link `youtube.com/watch?v=<id>` al
//    renderizar.
//
// La misma lógica está duplicada (defensivamente) en el server:
//  server/services/youtube/youtubeVideo.js#parseYouTubeVideoId. Mantener
//  ambos en sincronía si se agregan nuevos formatos.

export const YOUTUBE_VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extrae el videoId de YouTube de un input en cualquiera de estos formatos:
 *  - https://www.youtube.com/watch?v=<id>[&otros=params]
 *  - https://youtu.be/<id>[?si=...]
 *  - https://www.youtube.com/embed/<id>
 *  - https://www.youtube.com/shorts/<id>
 *  - <id> directo (11 chars [A-Za-z0-9_-])
 *
 * @param {string} input — URL completo o ID puro.
 * @returns {string|null} videoId o null si no se pudo parsear.
 */
export function parseYouTubeVideoId(input) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Caso 1: ID puro.
  if (YOUTUBE_VIDEO_ID_REGEX.test(trimmed)) return trimmed;

  // Caso 2: URL — probamos varios patrones.
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})(?:[&?#]|$)/, // watch?v=ID
    /youtu\.be\/([A-Za-z0-9_-]{11})(?:[?#]|$)/, // youtu.be/ID
    /\/embed\/([A-Za-z0-9_-]{11})(?:[?#]|$)/, // /embed/ID
    /\/shorts\/([A-Za-z0-9_-]{11})(?:[?#]|$)/, // /shorts/ID
  ];
  for (const re of patterns) {
    const m = re.exec(trimmed);
    if (m) return m[1];
  }
  return null;
}

/**
 * Reconstruye un URL canónico de YouTube a partir de un videoId.
 * @param {string} videoId
 * @returns {string}
 */
export function youtubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

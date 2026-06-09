// Resolución de short links del lado cliente. Pide (o reusa) un código corto
// para un recurso compartible y arma el URL `<origin>/s/<code>`.
//
// - Cachea por `type:ref` a nivel de módulo y deduplica los requests en vuelo,
//   así un feed con N tarjetas del mismo recurso pega UNA sola vez al server.
// - Ante cualquier error devuelve `null` para que el caller caiga al link
//   largo (el deeplink canónico siempre funciona).
//
// El `origin` se pasa explícito (en vez de leer `window` acá) para que quede
// el subdominio de comunidad activo y para poder testear sin jsdom-globals.

import axios from "axios";
import { API } from "../api/endpoints";

// type:ref → Promise<string|null> (path corto, p.ej. "/s/Ab3xK9"). Guardamos
// la promesa, no el valor, para deduplicar los in-flight.
const cache = new Map();

function fetchShortPath(type, ref) {
  // `Promise.resolve().then(...)` envuelve la llamada para que un throw SÍNCRONO
  // (p.ej. axios mockeado sin `.post`) también caiga en el `.catch` — el
  // contrato es "nunca tira, devuelve null ante cualquier error".
  return Promise.resolve()
    .then(() => axios.post(API.shortlinks.CREATE, { type, ref }))
    .then(({ data }) => (data?.code ? `/s/${data.code}` : null))
    .catch(() => {
      // No cachear el fallo: el próximo intento puede reintentar.
      cache.delete(`${type}:${ref}`);
      return null;
    });
}

// Devuelve el path corto (`/s/<code>`) o null. Cacheado + deduplicado.
export function getShortPath({ type, ref }) {
  if (!type || !ref) return Promise.resolve(null);
  const key = `${type}:${ref}`;
  if (!cache.has(key)) cache.set(key, fetchShortPath(type, ref));
  return cache.get(key);
}

// Devuelve el URL corto absoluto (`<origin>/s/<code>`) o null.
export async function getShortUrl({ type, ref, origin = "" }) {
  const path = await getShortPath({ type, ref });
  return path ? `${origin}${path}` : null;
}

// Solo para tests — limpia la caché entre casos.
export function __resetShortLinkCache() {
  cache.clear();
}

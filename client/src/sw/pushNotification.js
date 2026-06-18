// Lógica PURA para transformar el payload de un Web Push en los argumentos de
// `registration.showNotification(title, options)`. Vive separada de sw.js (que
// solo cablea los listeners del service worker a esta función) para poder
// testearla en jsdom sin globals de SW.
//
// El copy sale de getNotifMeta()/notifLink() de utils/notifDomains.js — las
// MISMAS funciones que usa la bandeja in-app, así el texto del push y el de la
// app nunca divergen (única fuente de verdad para las 34 notifs).
import { getNotifMeta, notifLink } from "../utils/notifDomains";

export function buildPushNotification(data = {}) {
  const meta = getNotifMeta(data);
  const url = notifLink(data);
  return {
    title: meta.title || "TurnoCero",
    options: {
      body: meta.body || "",
      // icon = logo a color (lado grande de la notif). badge = silueta
      // monocroma de la marca para la barra de estado de Android, que lo
      // enmascara por alfa (un PNG opaco saldría como cuadrado blanco).
      icon: "/pwa-192x192.png",
      badge: "/badge-96x96.png",
      // tag por notifId colapsa pushes repetidos de la MISMA notif evolutiva
      // (p.ej. un contador de chat) en una sola entrada del OS; cae a `type`.
      tag: data.notifId || data.type || undefined,
      renotify: !!data.notifId,
      data: { url, notifId: data.notifId || null, type: data.type || null },
    },
  };
}

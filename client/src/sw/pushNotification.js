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
  // Notificación de prueba (botón del panel admin): copy explícito que viaja en
  // el payload. No pasa por getNotifMeta porque "test" no es un tipo real de
  // notificación. Tag fijo para que pruebas sucesivas se colapsen en una sola
  // entrada del OS.
  if (data.test) {
    return {
      title: data.title || "Notificación de prueba",
      options: {
        body: data.body || "Si ves esto, las notificaciones push funcionan. 🎲",
        icon: "/pwa-192x192.png",
        badge: "/badge-96x96.png",
        tag: "turnocero-test-push",
        renotify: true,
        data: { url: data.url || "/panel-admin", notifId: null, type: "test" },
      },
    };
  }
  const meta = getNotifMeta(data);
  const url = notifLink(data);
  return {
    title: meta.title || "TurnoCero",
    options: {
      body: meta.body || "",
      // icon = logo a color (lado grande de la notif). badge = silueta de
      // meeple BLANCA sobre transparente para la barra de estado de Android,
      // que la enmascara por alfa: tiene que ser monocroma (un PNG opaco sale
      // como cuadrado blanco) y un solo glifo simple+grueso+con padding — el
      // wordmark "TO" se empastaba en una mancha a ~24dp. Ver badge-96x96.png.
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

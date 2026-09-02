// Lógica PURA para transformar el payload de un Web Push en los argumentos de
// `registration.showNotification(title, options)`. Vive separada de sw.js (que
// solo cablea los listeners del service worker a esta función) para poder
// testearla en jsdom sin globals de SW.
//
// El copy sale de getNotifMeta()/notifLink() de utils/notifDomains.js — las
// MISMAS funciones que usa la bandeja in-app, así el texto del push y el de la
// app nunca divergen (única fuente de verdad para las 34 notifs).
import { getNotifMeta, notifLink } from "../utils/notifDomains";
import { notifT } from "./swI18n";

export function buildPushNotification(data = {}) {
  // `t` fijado al idioma del payload (default es) + ns `notifs`.
  const t = notifT(data.language);
  // Notificación de prueba (botón del panel admin): copy explícito que viaja en
  // el payload. No pasa por getNotifMeta porque "test" no es un tipo real de
  // notificación. Tag fijo para que pruebas sucesivas se colapsen en una sola
  // entrada del OS.
  if (data.test) {
    return {
      title: data.title || t("notifs:test.title"),
      options: {
        body: data.body || t("notifs:test.body"),
        icon: "/pwa-192x192.png",
        badge: "/badge-96x96.png",
        tag: "turnocero-test-push",
        renotify: true,
        data: { url: data.url || "/panel-admin", notifId: null, type: "test" },
      },
    };
  }
  const meta = getNotifMeta(data, t);
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

// Arma la URL a la que navega el click en la notificación OS, agregando
// `?readNotif=<notifId>` cuando lo hay. El SW no tiene el JWT del usuario
// para marcar la notif leída pegándole a la API directamente — pasamos el
// notifId por query y usePushNotifRead (client-side, con sesión) hace el
// PATCH y limpia la URL una vez que la app bootea/enfoca.
export function buildNotificationClickUrl({ url, notifId } = {}) {
  const base = url || "/notificaciones";
  if (!notifId) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}readNotif=${encodeURIComponent(notifId)}`;
}

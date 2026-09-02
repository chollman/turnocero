import { describe, it, expect } from "vitest";
import {
  buildPushNotification,
  buildNotificationClickUrl,
} from "./pushNotification";
import { getNotifMeta, notifLink } from "../utils/notifDomains";
import { notifT } from "./swI18n";

// El push usa el mismo `t` que buildPushNotification (idioma del payload,
// default es) para que la paridad con la bandeja in-app siga siendo exacta.
const tFor = (data) => notifT(data.language);

describe("buildPushNotification", () => {
  // Guard de paridad: el copy del push debe salir EXACTO de las mismas funciones
  // puras que usa la bandeja in-app, así nunca divergen.
  const cases = [
    { type: "dm", fromUserId: "u1", fromUsername: "Ana", lastMessagePreview: "hola", count: 1 },
    { type: "chat", tableId: "t1", tableName: "Catan", lastSenderUsername: "b", count: 3 },
    { type: "friend_request", fromUserId: "u2", fromUsername: "Pepe" },
    { type: "evento_reminder", eventoId: "e1", eventoTitle: "Jornada" },
    {
      type: "community_join_request",
      communitySlug: "rosario",
      communityName: "Rosario",
      actors: [{ username: "Lu" }],
      count: 1,
    },
    { type: "bgg_play_shared", fromUsername: "Joaco", gameName: "Wingspan", notifId: "n9" },
  ];

  it.each(cases)("title/body/url coinciden con notifDomains ($type)", (data) => {
    const meta = getNotifMeta(data, tFor(data));
    const { title, options } = buildPushNotification(data);
    expect(title).toBe(meta.title);
    expect(options.body).toBe(meta.body || "");
    expect(options.data.url).toBe(notifLink(data));
  });

  it("usa notifId como tag cuando está presente", () => {
    const { options } = buildPushNotification({ type: "dm", notifId: "abc" });
    expect(options.tag).toBe("abc");
    expect(options.renotify).toBe(true);
  });

  it("cae al type como tag cuando no hay notifId", () => {
    const { options } = buildPushNotification({ type: "friend_request" });
    expect(options.tag).toBe("friend_request");
    expect(options.renotify).toBe(false);
  });

  it("incluye icon (logo a color) y badge (silueta monocroma)", () => {
    const { options } = buildPushNotification({ type: "dm" });
    expect(options.icon).toBe("/pwa-192x192.png");
    expect(options.badge).toBe("/badge-96x96.png");
  });

  it("title cae a 'TurnoCero' y url a /notificaciones para data vacía/desconocida", () => {
    const data = { type: "__unknown__" };
    const { title, options } = buildPushNotification(data);
    expect(title).toBe(getNotifMeta(data, tFor(data)).title);
    expect(options.data.url).toBe(notifLink(data));
  });

  describe("payload de prueba (test: true)", () => {
    it("usa el title/body/url explícitos del payload, sin pasar por notifDomains", () => {
      const { title, options } = buildPushNotification({
        test: true,
        title: "Notificación de prueba",
        body: "Funciona 🎲",
        url: "/panel-admin",
      });
      expect(title).toBe("Notificación de prueba");
      expect(options.body).toBe("Funciona 🎲");
      expect(options.data.url).toBe("/panel-admin");
      expect(options.data.type).toBe("test");
      expect(options.tag).toBe("turnocero-test-push");
    });

    it("cae a copy y url por defecto cuando el payload solo trae test", () => {
      const { title, options } = buildPushNotification({ test: true });
      expect(title).toBe("Notificación de prueba");
      expect(options.body).toMatch(/funcionan/i);
      expect(options.data.url).toBe("/panel-admin");
    });
  });
});

describe("buildNotificationClickUrl", () => {
  it("agrega ?readNotif=<notifId> cuando hay notifId", () => {
    expect(
      buildNotificationClickUrl({ url: "/mesas/t1", notifId: "n1" }),
    ).toBe("/mesas/t1?readNotif=n1");
  });

  it("usa & si la url ya trae query string", () => {
    expect(
      buildNotificationClickUrl({ url: "/mesas/t1?tab=chat", notifId: "n1" }),
    ).toBe("/mesas/t1?tab=chat&readNotif=n1");
  });

  it("no agrega el param cuando no hay notifId", () => {
    expect(buildNotificationClickUrl({ url: "/mesas/t1" })).toBe(
      "/mesas/t1",
    );
  });

  it("cae a /notificaciones cuando no hay url ni notifId", () => {
    expect(buildNotificationClickUrl({})).toBe("/notificaciones");
    expect(buildNotificationClickUrl()).toBe("/notificaciones");
  });

  it("encodea el notifId", () => {
    expect(
      buildNotificationClickUrl({ url: "/mesas/t1", notifId: "a b/c" }),
    ).toBe("/mesas/t1?readNotif=a%20b%2Fc");
  });
});

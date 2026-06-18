import { describe, it, expect } from "vitest";
import { buildPushNotification } from "./pushNotification";
import { getNotifMeta, notifLink } from "../utils/notifDomains";

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
    const meta = getNotifMeta(data);
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
    const { title, options } = buildPushNotification({ type: "__unknown__" });
    expect(title).toBe(getNotifMeta({ type: "__unknown__" }).title);
    expect(options.data.url).toBe(notifLink({ type: "__unknown__" }));
  });
});

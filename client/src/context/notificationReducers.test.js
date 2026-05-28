import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  notifKey,
  resourceKey,
  mergeNotifs,
  pushToast,
  applyChatNotif,
  applyCommentNotif,
  applyImageNotif,
  applyJoinRequestNotif,
  applyPlayerJoinedNotif,
  applyJoinAcceptedNotif,
  applyJoinRejectedNotif,
  applySpotOpenedNotif,
  applyTableCancelledNotif,
  applyFriendRequestNotif,
  applyFriendAcceptedNotif,
  applyDmMessageNotif,
  applyAdminMessageNotif,
  applyTorneoNotif,
  applyCompartidaCommentNotif,
  applyCompartidaLikeNotif,
  applyNoticiaPublishedNotif,
  applyEventoNotif,
  markReadByPredicate,
  EVENT_SECTION,
  EVENTO_TYPE_MAP,
} from "./notificationReducers";

// ── Helpers ──────────────────────────────────────────────────────────

// Spy "setter" que aplica el updater contra un state inicial y guarda
// el resultado para inspección.
function makeSetterSpy(initial = []) {
  const calls = [];
  let state = initial;
  const fn = vi.fn((updater) => {
    state = typeof updater === "function" ? updater(state) : updater;
    calls.push(state);
  });
  fn.state = () => state;
  fn.calls = calls;
  return fn;
}

// ── keys + merge ──────────────────────────────────────────────────────

describe("notifKey", () => {
  it("prioriza el _id real del server cuando existe", () => {
    expect(notifKey({ _id: "abc", type: "chat", tableId: "t1" })).toBe(
      "id:abc",
    );
    expect(notifKey({ notifId: "xyz", type: "chat", tableId: "t1" })).toBe(
      "id:xyz",
    );
  });

  it("usa resource key como fallback sin _id", () => {
    expect(notifKey({ type: "chat", tableId: "t1" })).toBe("chat:t:t1");
    expect(notifKey({ type: "tournament_started", torneoId: "r1" })).toBe(
      "tournament_started:r:r1",
    );
    expect(notifKey({ type: "dm", fromUserId: "u1" })).toBe("dm:u:u1");
    expect(notifKey({ type: "evento_confirmed", eventoId: "e1" })).toBe(
      "evento_confirmed:e:e1",
    );
    expect(notifKey({ type: "compartida_like", compartidaId: "c1" })).toBe(
      "compartida_like:c:c1",
    );
  });

  it("default type es 'chat' si no viene", () => {
    expect(notifKey({ tableId: "t1" })).toBe("chat:t:t1");
  });
});

describe("resourceKey", () => {
  it("nunca usa _id, solo resource", () => {
    expect(resourceKey({ _id: "abc", type: "chat", tableId: "t1" })).toBe(
      "chat:t:t1",
    );
  });
});

describe("mergeNotifs", () => {
  it("dedupea por notifId — server gana", () => {
    const server = [{ _id: "n1", type: "chat", tableId: "t1", count: 5 }];
    const local = [{ _id: "n1", type: "chat", tableId: "t1", count: 99 }];
    const out = mergeNotifs(server, local);
    expect(out).toHaveLength(1);
    expect(out[0].count).toBe(5); // server gana
  });

  it("dedupea por resource key cuando local no tiene _id", () => {
    const server = [{ _id: "n1", type: "chat", tableId: "t1", count: 7 }];
    const local = [{ type: "chat", tableId: "t1", count: 1 }];
    const out = mergeNotifs(server, local);
    expect(out).toHaveLength(1);
    expect(out[0]._id).toBe("n1");
    expect(out[0].count).toBe(7);
  });

  it("preserva notifs que solo existen en local", () => {
    const server = [{ _id: "n1", type: "chat", tableId: "t1" }];
    const local = [{ type: "comment", tableId: "t2" }];
    const out = mergeNotifs(server, local);
    expect(out).toHaveLength(2);
  });

  it("retorna lista vacía con inputs vacíos", () => {
    expect(mergeNotifs([], [])).toEqual([]);
  });
});

// ── toasts ──────────────────────────────────────────────────────────

describe("pushToast", () => {
  it("agrega un toast nuevo con id único", () => {
    const out = pushToast([], { type: "chat", tableId: "t1" });
    expect(out).toHaveLength(1);
    expect(out[0].id).toMatch(/^\d+-/);
    expect(out[0].type).toBe("chat");
  });

  it("dedupe por (type, resource) — reemplaza el anterior", () => {
    let toasts = pushToast([], {
      type: "chat",
      tableId: "t1",
      messagePreview: "old",
    });
    toasts = pushToast(toasts, {
      type: "chat",
      tableId: "t1",
      messagePreview: "new",
    });
    expect(toasts).toHaveLength(1);
    expect(toasts[0].messagePreview).toBe("new");
  });

  it("trunca a un máximo de 4 toasts", () => {
    let toasts = [];
    for (let i = 0; i < 10; i++) {
      toasts = pushToast(toasts, { type: "chat", tableId: `t${i}` });
    }
    expect(toasts).toHaveLength(4);
    // El más viejo cae, los últimos quedan.
    expect(toasts.map((t) => t.tableId)).toEqual(["t6", "t7", "t8", "t9"]);
  });
});

// ── Mesas / Tables ───────────────────────────────────────────────────

describe("applyChatNotif", () => {
  const payload = {
    notifId: "n1",
    tableId: "t1",
    tableName: "Catan",
    count: 3,
    senderUsername: "alice",
    messagePreview: "hola",
    timestamp: "2026-05-22T10:00:00Z",
  };

  it("agrega notif nueva cuando no existe", () => {
    const setN = makeSetterSpy([]);
    const setT = makeSetterSpy([]);
    applyChatNotif({ setNotifications: setN, setToasts: setT, payload });
    expect(setN.state()).toEqual([
      {
        _id: "n1",
        notifId: "n1",
        type: "chat",
        tableId: "t1",
        tableName: "Catan",
        count: 3,
        read: false,
        timestamp: "2026-05-22T10:00:00Z",
        lastSenderUsername: "alice",
        lastMessagePreview: "hola",
      },
    ]);
  });

  it("actualiza notif existente — usa count del SERVER (no incrementa)", () => {
    const prev = [
      {
        _id: "old",
        notifId: "old",
        type: "chat",
        tableId: "t1",
        count: 99, // stale
        read: true,
      },
    ];
    const setN = makeSetterSpy(prev);
    const setT = makeSetterSpy([]);
    applyChatNotif({
      setNotifications: setN,
      setToasts: setT,
      payload: { ...payload, count: 5 },
    });
    expect(setN.state()[0].count).toBe(5); // SETEA, no suma
    expect(setN.state()[0].read).toBe(false);
    expect(setN.state()[0].notifId).toBe("n1"); // toma el del payload
  });

  it("dispara un toast con los datos del mensaje", () => {
    const setN = makeSetterSpy([]);
    const setT = makeSetterSpy([]);
    applyChatNotif({ setNotifications: setN, setToasts: setT, payload });
    expect(setT.state()).toHaveLength(1);
    expect(setT.state()[0].messagePreview).toBe("hola");
  });
});

describe("applyCommentNotif", () => {
  it("agrega notif y toast con preview", () => {
    const setN = makeSetterSpy([]);
    const setT = makeSetterSpy([]);
    applyCommentNotif({
      setNotifications: setN,
      setToasts: setT,
      payload: {
        notifId: "n2",
        tableId: "t1",
        tableName: "Catan",
        count: 2,
        commenterUsername: "bob",
        commentPreview: "qué partida",
        timestamp: "x",
      },
    });
    expect(setN.state()[0].type).toBe("comment");
    expect(setN.state()[0].lastCommenterUsername).toBe("bob");
    expect(setT.state()[0].commentPreview).toBe("qué partida");
  });
});

describe("applyImageNotif", () => {
  it("agrega notif image y toast", () => {
    const setN = makeSetterSpy([]);
    const setT = makeSetterSpy([]);
    applyImageNotif({
      setNotifications: setN,
      setToasts: setT,
      payload: {
        notifId: "n3",
        tableId: "t1",
        tableName: "Catan",
        count: 1,
        uploaderUsername: "carla",
        timestamp: "x",
      },
    });
    expect(setN.state()[0].type).toBe("image");
    expect(setN.state()[0].lastUploaderUsername).toBe("carla");
  });
});

describe("applyJoinRequestNotif", () => {
  it("usa count del server", () => {
    const setN = makeSetterSpy([]);
    const setT = makeSetterSpy([]);
    applyJoinRequestNotif({
      setNotifications: setN,
      setToasts: setT,
      payload: {
        notifId: "n4",
        tableId: "t1",
        tableName: "Catan",
        count: 4,
        requesterUsername: "dani",
        timestamp: "x",
      },
    });
    expect(setN.state()[0].count).toBe(4);
  });
});

describe("applyPlayerJoinedNotif", () => {
  it("agrega notif aggregating con count del server + tableName y lastJoinerUsername", () => {
    const setN = makeSetterSpy([]);
    const setT = makeSetterSpy([]);
    applyPlayerJoinedNotif({
      setNotifications: setN,
      setToasts: setT,
      payload: {
        notifId: "pj1",
        tableId: "t1",
        tableName: "Catán",
        count: 1,
        joinerUsername: "ana",
        timestamp: "x",
      },
    });
    expect(setN.state()).toHaveLength(1);
    expect(setN.state()[0].type).toBe("player_joined");
    expect(setN.state()[0].tableName).toBe("Catán");
    expect(setN.state()[0].lastJoinerUsername).toBe("ana");
    expect(setN.state()[0].count).toBe(1);
    expect(setT.state()[0].type).toBe("player_joined");
    expect(setT.state()[0].joinerUsername).toBe("ana");
  });

  it("acumula joins consecutivos en la misma notif", () => {
    const setN = makeSetterSpy([]);
    const setT = makeSetterSpy([]);
    applyPlayerJoinedNotif({
      setNotifications: setN,
      setToasts: setT,
      payload: {
        notifId: "pj1",
        tableId: "t1",
        tableName: "Catán",
        count: 1,
        joinerUsername: "ana",
        timestamp: "x",
      },
    });
    applyPlayerJoinedNotif({
      setNotifications: setN,
      setToasts: setT,
      payload: {
        notifId: "pj1",
        tableId: "t1",
        tableName: "Catán",
        count: 2,
        joinerUsername: "bob",
        timestamp: "y",
      },
    });
    // Una sola notif persistente; el count usa el valor del server (2).
    expect(setN.state()).toHaveLength(1);
    expect(setN.state()[0].count).toBe(2);
    expect(setN.state()[0].lastJoinerUsername).toBe("bob");
  });
});

describe("applyJoinAcceptedNotif", () => {
  it("reemplaza notif previa del mismo tableId (no incrementa)", () => {
    const prev = [
      { type: "join_accepted", tableId: "t1", count: 1, read: true },
    ];
    const setN = makeSetterSpy(prev);
    const setT = makeSetterSpy([]);
    applyJoinAcceptedNotif({
      setNotifications: setN,
      setToasts: setT,
      payload: { tableId: "t1", tableName: "Catan", timestamp: "x" },
    });
    expect(setN.state()).toHaveLength(1);
    expect(setN.state()[0].read).toBe(false);
    expect(setN.state()[0].count).toBe(1);
  });
});

describe("applyJoinRejectedNotif", () => {
  it("agrega notif join_rejected", () => {
    const setN = makeSetterSpy([]);
    const setT = makeSetterSpy([]);
    applyJoinRejectedNotif({
      setNotifications: setN,
      setToasts: setT,
      payload: { tableId: "t1", tableName: "Catan", timestamp: "x" },
    });
    expect(setN.state()[0].type).toBe("join_rejected");
  });
});

describe("applySpotOpenedNotif", () => {
  it("agrega notif spot_opened", () => {
    const setN = makeSetterSpy([]);
    const setT = makeSetterSpy([]);
    applySpotOpenedNotif({
      setNotifications: setN,
      setToasts: setT,
      payload: { tableId: "t1", tableName: "Catan", timestamp: "x" },
    });
    expect(setN.state()[0].type).toBe("spot_opened");
  });
});

describe("applyTableCancelledNotif", () => {
  it("agrega notif table_cancelled", () => {
    const setN = makeSetterSpy([]);
    const setT = makeSetterSpy([]);
    applyTableCancelledNotif({
      setNotifications: setN,
      setToasts: setT,
      payload: { tableId: "t1", tableName: "Catan", timestamp: "x" },
    });
    expect(setN.state()[0].type).toBe("table_cancelled");
  });
});

// ── Friends ───────────────────────────────────────────────────────────

describe("applyFriendRequestNotif", () => {
  it("agrega si no existe del mismo fromUserId", () => {
    const setN = makeSetterSpy([]);
    const setT = makeSetterSpy([]);
    applyFriendRequestNotif({
      setNotifications: setN,
      setToasts: setT,
      payload: { fromUserId: "u1", fromUsername: "alice" },
    });
    expect(setN.state()[0].type).toBe("friend_request");
  });

  it("NO duplica si ya hay request del mismo user", () => {
    const prev = [
      { type: "friend_request", fromUserId: "u1", count: 1, read: false },
    ];
    const setN = makeSetterSpy(prev);
    const setT = makeSetterSpy([]);
    applyFriendRequestNotif({
      setNotifications: setN,
      setToasts: setT,
      payload: { fromUserId: "u1", fromUsername: "alice" },
    });
    expect(setN.state()).toHaveLength(1);
    expect(setN.state()).toEqual(prev);
  });
});

describe("applyFriendAcceptedNotif", () => {
  it("dispara onAccepted callback", () => {
    const setN = makeSetterSpy([]);
    const setT = makeSetterSpy([]);
    const onAccepted = vi.fn();
    applyFriendAcceptedNotif({
      setNotifications: setN,
      setToasts: setT,
      payload: { fromUserId: "u1", fromUsername: "alice" },
      onAccepted,
    });
    expect(onAccepted).toHaveBeenCalledTimes(1);
  });
});

// ── DM ───────────────────────────────────────────────────────────────

describe("applyDmMessageNotif", () => {
  it("usa count del payload cuando viene (server-pushed)", () => {
    const setN = makeSetterSpy([]);
    applyDmMessageNotif({
      setNotifications: setN,
      payload: {
        notifId: "n5",
        from: { _id: "u1", username: "alice" },
        content: "hola",
        count: 7,
      },
    });
    expect(setN.state()[0].count).toBe(7);
    expect(setN.state()[0].lastMessagePreview).toBe("hola");
  });

  it("fallback a count+1 si el payload no trae count (compat)", () => {
    const prev = [{ type: "dm", fromUserId: "u1", count: 2, read: false }];
    const setN = makeSetterSpy(prev);
    applyDmMessageNotif({
      setNotifications: setN,
      payload: { from: { _id: "u1", username: "alice" }, content: "x" },
    });
    expect(setN.state()[0].count).toBe(3);
  });

  it("dispara onMessage con el payload", () => {
    const setN = makeSetterSpy([]);
    const onMessage = vi.fn();
    const payload = { from: "u1", content: "x", count: 1 };
    applyDmMessageNotif({ setNotifications: setN, payload, onMessage });
    expect(onMessage).toHaveBeenCalledWith(payload);
  });
});

// ── Admin chat ───────────────────────────────────────────────────────

describe("applyAdminMessageNotif", () => {
  it("NO agrega notif si isActive() es true (user está viendo el chat)", () => {
    const setN = makeSetterSpy([]);
    applyAdminMessageNotif({
      setNotifications: setN,
      payload: { from: { username: "x" }, content: "y" },
      isActive: () => true,
    });
    expect(setN).not.toHaveBeenCalled();
  });

  it("agrega notif admin_chat si isActive() es false", () => {
    const setN = makeSetterSpy([]);
    applyAdminMessageNotif({
      setNotifications: setN,
      payload: {
        notifId: "n6",
        from: { username: "alice" },
        content: "hola",
        count: 2,
      },
      isActive: () => false,
    });
    expect(setN.state()[0].type).toBe("admin_chat");
    expect(setN.state()[0].count).toBe(2);
  });
});

// ── Torneos ──────────────────────────────────────────────────────────

describe("applyTorneoNotif", () => {
  it("setea el type según el parámetro", () => {
    const setN = makeSetterSpy([]);
    const setT = makeSetterSpy([]);
    applyTorneoNotif({
      setNotifications: setN,
      setToasts: setT,
      payload: { torneoId: "r1", torneoTitle: "Copa Catan" },
      type: "tournament_started",
    });
    expect(setN.state()[0].type).toBe("tournament_started");
    expect(setN.state()[0].count).toBe(1);
    expect(setT.state()[0].type).toBe("tournament_started");
  });

  it("reemplaza notif previa del mismo torneoId", () => {
    const prev = [
      {
        type: "tournament_advanced",
        torneoId: "r1",
        count: 1,
        read: true,
      },
    ];
    const setN = makeSetterSpy(prev);
    const setT = makeSetterSpy([]);
    applyTorneoNotif({
      setNotifications: setN,
      setToasts: setT,
      payload: { torneoId: "r1", torneoTitle: "x" },
      type: "tournament_advanced",
    });
    expect(setN.state()).toHaveLength(1);
    expect(setN.state()[0].read).toBe(false);
  });
});

// ── Compartidas ──────────────────────────────────────────────────────

describe("applyCompartidaCommentNotif", () => {
  it("usa count del server", () => {
    const setN = makeSetterSpy([]);
    const setT = makeSetterSpy([]);
    applyCompartidaCommentNotif({
      setNotifications: setN,
      setToasts: setT,
      payload: {
        notifId: "n7",
        compartidaId: "c1",
        compartidaTitle: "Mi compartida",
        count: 3,
        commenterUsername: "alice",
        commentPreview: "muy bueno",
        timestamp: "x",
      },
    });
    expect(setN.state()[0].count).toBe(3);
    expect(setN.state()[0].compartidaTitle).toBe("Mi compartida");
  });
});

describe("applyCompartidaLikeNotif", () => {
  it("agrega notif compartida_like", () => {
    const setN = makeSetterSpy([]);
    const setT = makeSetterSpy([]);
    applyCompartidaLikeNotif({
      setNotifications: setN,
      setToasts: setT,
      payload: {
        notifId: "n8",
        compartidaId: "c1",
        compartidaTitle: "x",
        count: 5,
        fromUsername: "bob",
        timestamp: "x",
      },
    });
    expect(setN.state()[0].type).toBe("compartida_like");
    expect(setN.state()[0].count).toBe(5);
  });
});

// ── Noticias ─────────────────────────────────────────────────────────

describe("applyNoticiaPublishedNotif", () => {
  it("solo dispara toast, no persiste notif", () => {
    const setT = makeSetterSpy([]);
    applyNoticiaPublishedNotif({
      setToasts: setT,
      payload: { noticiaId: "x", title: "Nueva versión" },
    });
    expect(setT.state()).toHaveLength(1);
    expect(setT.state()[0].type).toBe("noticia");
  });
});

// ── Eventos ──────────────────────────────────────────────────────────

describe("applyEventoNotif", () => {
  it("mapea type short ('confirmed') a long ('evento_confirmed')", () => {
    const setN = makeSetterSpy([]);
    const setT = makeSetterSpy([]);
    applyEventoNotif({
      setNotifications: setN,
      setToasts: setT,
      payload: {
        notifId: "n9",
        type: "confirmed",
        eventoId: "e1",
        eventoTitle: "Mi evento",
        count: 1,
      },
    });
    expect(setN.state()[0].type).toBe("evento_confirmed");
  });

  it("acepta type ya largo sin tocarlo", () => {
    const setN = makeSetterSpy([]);
    const setT = makeSetterSpy([]);
    applyEventoNotif({
      setNotifications: setN,
      setToasts: setT,
      payload: {
        type: "evento_updated",
        eventoId: "e1",
        eventoTitle: "x",
      },
    });
    expect(setN.state()[0].type).toBe("evento_updated");
  });

  it("descarta payload sin type válido", () => {
    const setN = makeSetterSpy([]);
    const setT = makeSetterSpy([]);
    applyEventoNotif({
      setNotifications: setN,
      setToasts: setT,
      payload: { type: "garbage", eventoId: "e1" },
    });
    expect(setN).not.toHaveBeenCalled();
    expect(setT).not.toHaveBeenCalled();
  });

  it("NO dispara toast si isActive devuelve true", () => {
    const setN = makeSetterSpy([]);
    const setT = makeSetterSpy([]);
    applyEventoNotif({
      setNotifications: setN,
      setToasts: setT,
      payload: { type: "confirmed", eventoId: "e1" },
      isActive: (id) => id === "e1",
    });
    expect(setN).toHaveBeenCalled(); // notif sí se persiste
    expect(setT).not.toHaveBeenCalled(); // toast no
  });

  it("preserva count del server para tipos aggregating", () => {
    const setN = makeSetterSpy([]);
    const setT = makeSetterSpy([]);
    applyEventoNotif({
      setNotifications: setN,
      setToasts: setT,
      payload: {
        type: "ludoteca_added",
        eventoId: "e1",
        count: 4,
        gameName: "Catan",
      },
    });
    expect(setN.state()[0].count).toBe(4);
    expect(setN.state()[0].type).toBe("evento_ludoteca_added");
  });

  it("default count=1 para tipos non-aggregating sin payload.count", () => {
    const setN = makeSetterSpy([]);
    const setT = makeSetterSpy([]);
    applyEventoNotif({
      setNotifications: setN,
      setToasts: setT,
      payload: { type: "cancelled", eventoId: "e1" },
    });
    expect(setN.state()[0].count).toBe(1);
  });
});

// ── markRead ──────────────────────────────────────────────────────────

describe("markReadByPredicate", () => {
  it("resetea count a 0 y read a true para los que matchean", () => {
    const prev = [
      { type: "chat", tableId: "t1", count: 5, read: false },
      { type: "chat", tableId: "t2", count: 3, read: false },
    ];
    const out = markReadByPredicate(prev, (n) => n.tableId === "t1");
    expect(out[0]).toEqual({
      type: "chat",
      tableId: "t1",
      count: 0,
      read: true,
    });
    expect(out[1]).toEqual(prev[1]); // no se toca
  });
});

// ── Section gating ───────────────────────────────────────────────────

describe("EVENT_SECTION", () => {
  it("mapea cada evento socket conocido a una sección", () => {
    expect(EVENT_SECTION["chat:notification"]).toBe("mesas");
    expect(EVENT_SECTION["friend:request"]).toBe("amigos");
    expect(EVENT_SECTION["dm:message"]).toBe("dms");
    expect(EVENT_SECTION["evento:notification"]).toBe("eventos");
  });
});

describe("EVENTO_TYPE_MAP", () => {
  it("expone los 7 tipos de evento", () => {
    expect(EVENTO_TYPE_MAP.confirmed).toBe("evento_confirmed");
    expect(EVENTO_TYPE_MAP.rejected).toBe("evento_rejected");
    expect(EVENTO_TYPE_MAP.cancelled).toBe("evento_cancelled");
    expect(EVENTO_TYPE_MAP.updated).toBe("evento_updated");
    expect(EVENTO_TYPE_MAP.reminder).toBe("evento_reminder");
    expect(EVENTO_TYPE_MAP.ludoteca_added).toBe("evento_ludoteca_added");
    expect(EVENTO_TYPE_MAP.mesa_created).toBe("evento_mesa_created");
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});

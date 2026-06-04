import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";

vi.mock("../../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));
vi.mock("../../context/ChatContext", () => ({ useChat: vi.fn() }));

import Notifications from "./Notifications";
import { useNotifications } from "../../context/NotificationContext";
import { useChat } from "../../context/ChatContext";

let ctx, clearConversationUnreadMock;

function makeNotif(overrides = {}) {
  return {
    _id: overrides._id || `n${Math.random()}`,
    type: overrides.type || "comment",
    read: overrides.read ?? false,
    count: overrides.count ?? 1,
    tableId: overrides.tableId || "t1",
    tableName: overrides.tableName || "Mesa",
    updatedAt: overrides.updatedAt || new Date().toISOString(),
    ...overrides,
  };
}

function setup({ notifications = [] } = {}) {
  ctx = {
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    markRead: vi.fn(),
    markReadFriend: vi.fn(),
    markReadTorneo: vi.fn(),
    markReadCompartida: vi.fn(),
    markReadEvento: vi.fn(),
    markReadDm: vi.fn(),
    markReadAdminChat: vi.fn(),
    markAllRead: vi.fn(),
    loadOlder: vi.fn().mockResolvedValue({ count: 0 }),
    clearAll: vi.fn(),
    dismiss: vi.fn(),
    notifyFriendAdded: vi.fn(),
    addToast: vi.fn(),
  };
  useNotifications.mockReturnValue(ctx);
  useChat.mockReturnValue({
    clearConversationUnread: clearConversationUnreadMock,
  });
  return render(
    <MemoryRouter>
      <Notifications />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  clearConversationUnreadMock = vi.fn();
  server.use(
    http.patch("/api/dm/:userId/read", () => HttpResponse.json({ ok: true })),
    http.post("/api/friends/:id/accept", () => HttpResponse.json({ ok: true })),
    http.post("/api/friends/:id/reject", () => HttpResponse.json({ ok: true })),
    http.post("/api/tables/:id/requests/:userId/accept", () =>
      HttpResponse.json({ ok: true }),
    ),
    http.post("/api/tables/:id/requests/:userId/reject", () =>
      HttpResponse.json({ ok: true }),
    ),
  );
});

describe("<Notifications>", () => {
  it("renders the empty state when there are no notifications", () => {
    setup({ notifications: [] });
    expect(
      screen.getByText(/no tenés notificaciones nuevas/i),
    ).toBeInTheDocument();
  });

  it("renders one row per notification with its copy", () => {
    setup({
      notifications: [
        makeNotif({
          type: "comment",
          tableName: "Mesa Catán",
          lastCommenterUsername: "alice",
        }),
        makeNotif({
          type: "friend_request",
          fromUserId: "u1",
          fromUsername: "bob",
          tableId: undefined,
        }),
      ],
    });
    expect(
      screen.getByText(/alice comentó la mesa de/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/bob te envió una solicitud de amistad/i),
    ).toBeInTheDocument();
  });

  it("shows the unread count in the hero eyebrow", () => {
    setup({
      notifications: [makeNotif({ read: false }), makeNotif({ read: false })],
    });
    expect(screen.getByText(/2 sin leer/i)).toBeInTheDocument();
  });

  it("renders base filter chips + only domains that have notifications", () => {
    setup({
      notifications: [
        makeNotif({ type: "chat" }),
        makeNotif({
          type: "tournament_accepted",
          torneoTitle: "Copa",
          torneoId: "tt1",
          tableId: undefined,
        }),
      ],
    });
    expect(screen.getByRole("button", { name: /^todas/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sin leer/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /requieren acción/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mesas/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /torneos/i }),
    ).toBeInTheDocument();
    // No friend notifs → no "Amigos" chip.
    expect(
      screen.queryByRole("button", { name: /^amigos/i }),
    ).not.toBeInTheDocument();
  });

  it('"Sin leer" filter hides already-read notifications', () => {
    setup({
      notifications: [
        makeNotif({ type: "chat", tableName: "Mesa Leída", read: true }),
        makeNotif({ type: "chat", tableName: "Mesa Nueva", read: false }),
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: /sin leer/i }));
    expect(screen.queryByText(/Mesa Leída/)).not.toBeInTheDocument();
    expect(screen.getByText(/Mesa Nueva/)).toBeInTheDocument();
  });

  it('"Requieren acción" filter shows only actionable notifications', () => {
    setup({
      notifications: [
        makeNotif({ type: "chat", tableName: "Mesa Chat" }),
        makeNotif({
          type: "friend_request",
          fromUserId: "u1",
          fromUsername: "bob",
          tableId: undefined,
        }),
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: /requieren acción/i }));
    expect(screen.queryByText(/Mesa Chat/)).not.toBeInTheDocument();
    expect(screen.getByText(/bob te envió una solicitud/i)).toBeInTheDocument();
  });

  it("domain chip Torneos filters to torneo notifications", () => {
    setup({
      notifications: [
        makeNotif({ type: "chat", tableName: "Mesa Chat" }),
        makeNotif({
          type: "tournament_accepted",
          torneoId: "tn1",
          torneoTitle: "Copa X",
          tableId: undefined,
        }),
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: /torneos/i }));
    expect(screen.queryByText(/Mesa Chat/)).not.toBeInTheDocument();
    expect(screen.getByText(/Copa X/)).toBeInTheDocument();
  });

  it("renders time bucket headers", () => {
    setup({ notifications: [makeNotif({ read: false })] });
    // "Hoy" aparece como header de bucket y como stat del digest lateral.
    expect(screen.getAllByText("Hoy").length).toBeGreaterThan(0);
  });

  it('"Marcar todas" calls markAllRead', () => {
    setup({ notifications: [makeNotif({ read: false })] });
    fireEvent.click(screen.getByRole("button", { name: /marcar todas/i }));
    expect(ctx.markAllRead).toHaveBeenCalled();
  });

  it('"Limpiar" calls clearAll after confirm', () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    setup({ notifications: [makeNotif()] });
    fireEvent.click(screen.getByRole("button", { name: /limpiar/i }));
    expect(ctx.clearAll).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('"Limpiar" does NOT call clearAll when confirm cancelled', () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    setup({ notifications: [makeNotif()] });
    fireEvent.click(screen.getByRole("button", { name: /limpiar/i }));
    expect(ctx.clearAll).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("clicking a table row body marks read with tableId", () => {
    setup({
      notifications: [
        makeNotif({ type: "chat", tableId: "tX", tableName: "Mesa X" }),
      ],
    });
    fireEvent.click(screen.getByRole("link"));
    expect(ctx.markRead).toHaveBeenCalledWith("tX");
  });

  it("clicking a friend row marks read via markReadFriend", () => {
    setup({
      notifications: [
        makeNotif({
          type: "friend_accepted",
          fromUserId: "u1",
          fromUsername: "alice",
          tableId: undefined,
        }),
      ],
    });
    fireEvent.click(screen.getByRole("link"));
    expect(ctx.markReadFriend).toHaveBeenCalledWith("u1");
  });

  it("clicking a DM row marks read via markReadDm + clearConversationUnread", () => {
    setup({
      notifications: [
        makeNotif({
          type: "dm",
          fromUserId: "u3",
          fromUsername: "carol",
          tableId: undefined,
        }),
      ],
    });
    fireEvent.click(screen.getByRole("link"));
    expect(ctx.markReadDm).toHaveBeenCalledWith("u3");
    expect(clearConversationUnreadMock).toHaveBeenCalledWith("u3");
  });

  it("clicking an evento row marks read via markReadEvento", () => {
    setup({
      notifications: [
        makeNotif({
          type: "evento_confirmed",
          eventoId: "ev1",
          eventoTitle: "Torneo Otoño",
          tableId: undefined,
        }),
      ],
    });
    fireEvent.click(screen.getByRole("link"));
    expect(ctx.markReadEvento).toHaveBeenCalledWith("ev1");
  });

  it("hover mark-read button marks read without navigating", () => {
    setup({
      notifications: [
        makeNotif({ type: "chat", tableId: "tZ", tableName: "Mesa Z" }),
      ],
    });
    fireEvent.click(screen.getByLabelText("Marcar como leída"));
    expect(ctx.markRead).toHaveBeenCalledWith("tZ");
  });

  it("dismiss button calls dismiss with the notif id", () => {
    setup({
      notifications: [makeNotif({ _id: "id-7", type: "chat" })],
    });
    fireEvent.click(screen.getByLabelText("Descartar"));
    expect(ctx.dismiss).toHaveBeenCalledWith("id-7");
  });

  it("accepting a friend request POSTs accept, notifies, and shows ResolvedRow", async () => {
    setup({
      notifications: [
        makeNotif({
          _id: "f1",
          type: "friend_request",
          fromUserId: "u1",
          fromUsername: "bob",
          tableId: undefined,
          read: false,
        }),
      ],
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /aceptar/i }));
    });
    expect(ctx.notifyFriendAdded).toHaveBeenCalled();
    expect(
      await screen.findByText(/ahora sos amigo de bob/i),
    ).toBeInTheDocument();
  });

  it("accepting a join request POSTs to the requester and confirms", async () => {
    let hit = null;
    server.use(
      http.post("/api/tables/:id/requests/:userId/accept", ({ params }) => {
        hit = params;
        return HttpResponse.json({ ok: true });
      }),
    );
    setup({
      notifications: [
        makeNotif({
          _id: "j1",
          type: "join_request",
          tableId: "tabA",
          tableName: "Catán",
          actors: [{ userId: "u9", username: "lu" }],
          count: 1,
          read: false,
        }),
      ],
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /aceptar/i }));
    });
    await waitFor(() => expect(hit).toEqual({ id: "tabA", userId: "u9" }));
    expect(
      await screen.findByText(/aceptaste a lu en catán/i),
    ).toBeInTheDocument();
  });

  it("rejecting a friend request shows the discard ResolvedRow", async () => {
    setup({
      notifications: [
        makeNotif({
          _id: "f2",
          type: "friend_request",
          fromUserId: "u2",
          fromUsername: "ana",
          tableId: undefined,
          read: false,
        }),
      ],
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /rechazar/i }));
    });
    expect(
      await screen.findByText(/listo, lo descartamos/i),
    ).toBeInTheDocument();
  });

  it("a join request with multiple requesters shows a CTA instead of inline actions", () => {
    setup({
      notifications: [
        makeNotif({
          type: "join_request",
          tableId: "tabB",
          tableName: "Root",
          actors: [
            { userId: "a", username: "ana" },
            { userId: "b", username: "leo" },
          ],
          count: 2,
          read: false,
        }),
      ],
    });
    expect(
      screen.queryByRole("button", { name: /^aceptar$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /ver solicitudes/i }),
    ).toBeInTheDocument();
  });

  it("loadOlder button appears with ≥20 notifications and calls loadOlder", async () => {
    const notifications = Array.from({ length: 20 }, (_, i) =>
      makeNotif({ _id: `n${i}`, tableId: `t${i}`, read: true }),
    );
    setup({ notifications });
    const btn = screen.getByRole("button", { name: /cargar más/i });
    await act(async () => fireEvent.click(btn));
    expect(ctx.loadOlder).toHaveBeenCalled();
  });

  it("renders a wide spread of notification types without crashing", () => {
    setup({
      notifications: [
        makeNotif({ type: "join_accepted", tableName: "A" }),
        makeNotif({ type: "join_rejected", tableName: "C" }),
        makeNotif({ type: "spot_opened", tableName: "E" }),
        makeNotif({ type: "table_cancelled", tableName: "F" }),
        makeNotif({
          type: "tournament_advanced",
          torneoId: "tn2",
          torneoTitle: "Liga",
          round: 2,
          tableId: undefined,
        }),
        makeNotif({
          type: "compartida_like",
          compartidaId: "c2",
          compartidaTitle: "Like",
          lastSenderUsername: "ema",
          tableId: undefined,
        }),
        makeNotif({
          type: "admin_chat",
          tableId: undefined,
          count: 3,
          lastSenderUsername: "admin",
          lastMessagePreview: "msg",
        }),
        makeNotif({
          type: "evento_reminder",
          eventoId: "ev1",
          eventoTitle: "Evento",
          tableId: undefined,
        }),
      ],
    });
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(8);
  });
});

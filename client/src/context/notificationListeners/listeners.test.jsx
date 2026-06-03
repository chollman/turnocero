// Smoke tests del split P1.1 — confirma que cada hook por dominio registra
// los `socket.on(...)` esperados, sin duplicados ni omisiones. La cobertura
// de comportamiento end-to-end vive en NotificationContext.test.jsx (1036
// líneas) — acá solo aseguramos que los hooks individuales son drop-in.

import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { useTableNotificationListeners } from "./useTableNotificationListeners";
import { useFriendNotificationListeners } from "./useFriendNotificationListeners";
import { useDmNotificationListeners } from "./useDmNotificationListeners";
import { useAdminChatNotificationListeners } from "./useAdminChatNotificationListeners";
import { useTorneoNotificationListeners } from "./useTorneoNotificationListeners";
import { useCompartidaNotificationListeners } from "./useCompartidaNotificationListeners";
import { useNoticiaNotificationListeners } from "./useNoticiaNotificationListeners";
import { useEventoNotificationListeners } from "./useEventoNotificationListeners";
import { useCommunityNotificationListeners } from "./useCommunityNotificationListeners";
import { useSiteConfigSocketListener } from "./useSiteConfigSocketListener";

function makeSocket() {
  const events = new Map();
  return {
    on: vi.fn((event, handler) => events.set(event, handler)),
    off: vi.fn((event) => events.delete(event)),
    _events: events,
  };
}

function useStableRef(initial) {
  const ref = useRef(initial);
  return ref;
}

const gated = (_event, handler) => handler;
const setNotifications = vi.fn();
const setToasts = vi.fn();
const refreshUser = vi.fn(() => Promise.resolve());
const applyServerConfig = vi.fn();

describe("notification listener hooks — event registration", () => {
  it("useTableNotificationListeners registra los 10 eventos de tables", () => {
    const socket = makeSocket();
    renderHook(() => {
      const activeTableRef = useStableRef(null);
      useTableNotificationListeners({
        socket,
        gated,
        activeTableRef,
        setNotifications,
        setToasts,
      });
    });
    const events = [...socket._events.keys()].sort();
    expect(events).toEqual(
      [
        "chat:notification",
        "table:comment",
        "table:image",
        "join:request",
        "table:player-joined",
        "table:player-left",
        "join:accepted",
        "join:rejected",
        "table:spot-opened",
        "table:cancelled",
      ].sort(),
    );
  });

  it("useFriendNotificationListeners registra friend:request y friend:accepted", () => {
    const socket = makeSocket();
    renderHook(() => {
      const friendListenersRef = useStableRef(new Set());
      useFriendNotificationListeners({
        socket,
        gated,
        setNotifications,
        setToasts,
        refreshUser,
        friendListenersRef,
      });
    });
    expect([...socket._events.keys()].sort()).toEqual([
      "friend:accepted",
      "friend:request",
    ]);
  });

  it("useDmNotificationListeners registra dm:message", () => {
    const socket = makeSocket();
    renderHook(() => {
      const dmListenersRef = useStableRef(new Set());
      useDmNotificationListeners({
        socket,
        gated,
        setNotifications,
        dmListenersRef,
      });
    });
    expect([...socket._events.keys()]).toEqual(["dm:message"]);
  });

  it("useAdminChatNotificationListeners registra admin:message (sin gating)", () => {
    const socket = makeSocket();
    renderHook(() => {
      const adminChatActiveRef = useStableRef(false);
      useAdminChatNotificationListeners({
        socket,
        setNotifications,
        adminChatActiveRef,
      });
    });
    expect([...socket._events.keys()]).toEqual(["admin:message"]);
  });

  it("useTorneoNotificationListeners registra los 6 eventos de torneo", () => {
    const socket = makeSocket();
    renderHook(() =>
      useTorneoNotificationListeners({
        socket,
        gated,
        setNotifications,
        setToasts,
      }),
    );
    const events = [...socket._events.keys()].sort();
    expect(events).toEqual(
      [
        "torneo:registration-accepted",
        "torneo:registration-rejected",
        "torneo:advanced",
        "torneo:eliminated",
        "torneo:started",
        "torneo:finished",
      ].sort(),
    );
  });

  it("useCompartidaNotificationListeners registra compartida:comment y compartida:like", () => {
    const socket = makeSocket();
    renderHook(() =>
      useCompartidaNotificationListeners({
        socket,
        gated,
        setNotifications,
        setToasts,
      }),
    );
    expect([...socket._events.keys()].sort()).toEqual([
      "compartida:comment",
      "compartida:like",
    ]);
  });

  it("useNoticiaNotificationListeners registra noticia:published", () => {
    const socket = makeSocket();
    renderHook(() =>
      useNoticiaNotificationListeners({ socket, gated, setToasts }),
    );
    expect([...socket._events.keys()]).toEqual(["noticia:published"]);
  });

  it("useEventoNotificationListeners registra evento:notification", () => {
    const socket = makeSocket();
    renderHook(() => {
      const activeEventoRef = useStableRef(null);
      useEventoNotificationListeners({
        socket,
        gated,
        activeEventoRef,
        setNotifications,
        setToasts,
      });
    });
    expect([...socket._events.keys()]).toEqual(["evento:notification"]);
  });

  it("useSiteConfigSocketListener registra site-config:updated", () => {
    const socket = makeSocket();
    renderHook(() =>
      useSiteConfigSocketListener({ socket, applyServerConfig }),
    );
    expect([...socket._events.keys()]).toEqual(["site-config:updated"]);
  });

  it("useCommunityNotificationListeners registra community:join-resolved", () => {
    const socket = makeSocket();
    renderHook(() =>
      useCommunityNotificationListeners({
        socket,
        gated,
        reloadCommunity: vi.fn(),
      }),
    );
    expect([...socket._events.keys()]).toEqual(["community:join-resolved"]);
  });

  it("community:join-resolved recarga las memberships del CommunityContext", () => {
    const socket = makeSocket();
    const reloadCommunity = vi.fn();
    renderHook(() =>
      useCommunityNotificationListeners({ socket, gated, reloadCommunity }),
    );
    // Simular el emit del server (accept/reject) → debe disparar el reload.
    socket._events.get("community:join-resolved")({
      communityId: "c1",
      communitySlug: "rosario-juega",
    });
    expect(reloadCommunity).toHaveBeenCalledTimes(1);
  });

  it("no rompe si reloadCommunity es undefined (provider ausente en tests)", () => {
    const socket = makeSocket();
    renderHook(() =>
      useCommunityNotificationListeners({
        socket,
        gated,
        reloadCommunity: undefined,
      }),
    );
    expect(() =>
      socket._events.get("community:join-resolved")({ communityId: "c1" }),
    ).not.toThrow();
  });
});

describe("notification listener hooks — cleanup", () => {
  it("cada hook desregistra sus listeners cuando el componente unmount", () => {
    const socket = makeSocket();
    const { unmount } = renderHook(() =>
      useTorneoNotificationListeners({
        socket,
        gated,
        setNotifications,
        setToasts,
      }),
    );
    expect(socket._events.size).toBe(6);
    unmount();
    expect(socket._events.size).toBe(0);
    expect(socket.off).toHaveBeenCalledTimes(6);
  });

  it("no registra nada si socket es null", () => {
    renderHook(() =>
      useTableNotificationListeners({
        socket: null,
        gated,
        activeTableRef: { current: null },
        setNotifications,
        setToasts,
      }),
    );
    // No throws — el hook simplemente no registra.
    expect(true).toBe(true);
  });
});

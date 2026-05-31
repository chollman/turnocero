import { describe, it, expect } from "vitest";
import {
  getDomain,
  getDomainMeta,
  isActionable,
  getCountBadge,
  notifBucket,
  notifLink,
  notifTarget,
  getNotifMeta,
} from "./notifDomains";

describe("notifDomains", () => {
  describe("getDomain / getDomainMeta", () => {
    it("maps types to their domain", () => {
      expect(getDomain("chat")).toBe("mesa");
      expect(getDomain("friend_request")).toBe("amigo");
      expect(getDomain("compartida_like")).toBe("compartida");
      expect(getDomain("tournament_started")).toBe("torneo");
      expect(getDomain("evento_confirmed")).toBe("evento");
      expect(getDomain("admin_chat")).toBe("admin");
    });

    it("falls back to mesa for unknown types", () => {
      expect(getDomain("???")).toBe("mesa");
    });

    it("returns brand colorVar + icon per domain", () => {
      expect(getDomainMeta("chat").colorVar).toBe("--amber");
      expect(getDomainMeta("compartida_like").colorVar).toBe("--red");
      expect(getDomainMeta("tournament_started").icon).toBe("Trophy");
    });
  });

  describe("isActionable", () => {
    it("is true for unread friend_request and join_request", () => {
      expect(isActionable({ type: "friend_request", read: false })).toBe(true);
      expect(isActionable({ type: "join_request", read: false })).toBe(true);
    });
    it("is false when read or non-actionable", () => {
      expect(isActionable({ type: "friend_request", read: true })).toBe(false);
      expect(isActionable({ type: "chat", read: false })).toBe(false);
      expect(isActionable(null)).toBe(false);
    });
  });

  describe("getCountBadge", () => {
    it("returns count for aggregating types when > 1", () => {
      expect(getCountBadge({ type: "chat", count: 3 })).toBe(3);
    });
    it("returns null when count <= 1 or non-aggregating", () => {
      expect(getCountBadge({ type: "chat", count: 1 })).toBeNull();
      expect(getCountBadge({ type: "join_accepted", count: 5 })).toBeNull();
    });
  });

  describe("notifBucket", () => {
    const now = new Date("2026-05-30T12:00:00").getTime();
    it("buckets same-day as today", () => {
      expect(notifBucket("2026-05-30T08:00:00", now)).toBe("today");
    });
    it("buckets <7 days as week", () => {
      expect(notifBucket("2026-05-27T08:00:00", now)).toBe("week");
    });
    it("buckets older as earlier", () => {
      expect(notifBucket("2026-05-01T08:00:00", now)).toBe("earlier");
    });
    it("invalid dates fall to earlier", () => {
      expect(notifBucket("not-a-date", now)).toBe("earlier");
    });
  });

  describe("notifLink", () => {
    it("routes by resource", () => {
      expect(notifLink({ type: "admin_chat" })).toBe("/mensajes-admin");
      expect(notifLink({ type: "dm", fromUserId: "u1" })).toBe("/mensajes/u1");
      expect(notifLink({ type: "compartida_like", compartidaId: "c1" })).toBe(
        "/compartidas/c1",
      );
      expect(notifLink({ type: "evento_confirmed", eventoId: "e1" })).toBe(
        "/eventos/e1",
      );
      expect(notifLink({ type: "evento_cancelled", eventoDeleted: true })).toBe(
        "/eventos",
      );
      expect(notifLink({ type: "tournament_started", torneoId: "t1" })).toBe(
        "/torneos/t1",
      );
      expect(notifLink({ type: "friend_request", fromUserId: "u9" })).toBe(
        "/usuarios/u9",
      );
      expect(notifLink({ type: "chat", tableId: "tb1" })).toBe("/mesas/tb1");
    });
  });

  describe("notifTarget", () => {
    it("returns the resource name", () => {
      expect(notifTarget({ type: "chat", tableName: "Catán" })).toBe("Catán");
      expect(notifTarget({ type: "admin_chat" })).toBe("Chat de admins");
    });
  });

  describe("getNotifMeta", () => {
    it("singular vs plural join_request", () => {
      expect(
        getNotifMeta({
          type: "join_request",
          count: 1,
          lastRequesterUsername: "lu",
        }).title,
      ).toMatch(/lu quiere unirse/i);
      expect(getNotifMeta({ type: "join_request", count: 3 }).title).toMatch(
        /3 personas quieren unirse/i,
      );
    });

    it("compartida_like aggregates names with count", () => {
      const meta = getNotifMeta({
        type: "compartida_like",
        count: 8,
        lastSenderUsername: "cami",
      });
      expect(meta.title).toMatch(/cami y 7 más/i);
    });

    it("returns a cta for navigable types and null where destructive", () => {
      expect(getNotifMeta({ type: "evento_confirmed" }).cta).toBeTruthy();
      expect(getNotifMeta({ type: "table_cancelled" }).cta).toBeNull();
    });

    it("has a safe default for unknown types", () => {
      const meta = getNotifMeta({ type: "mystery" });
      expect(meta.title).toBeTruthy();
    });
  });
});

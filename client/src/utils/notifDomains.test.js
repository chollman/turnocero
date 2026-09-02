import { describe, it, expect, afterEach } from "vitest";
import i18n from "../i18n";
import {
  getDomain,
  getDomainMeta,
  getDomainLabel,
  isActionable,
  getCountBadge,
  notifBucket,
  notifLink,
  notifTarget,
  getNotifMeta,
} from "./notifDomains";

// `t` del singleton real (init en español por el test setup). Helper para no
// repetir la firma `(notif, i18n.t)` en cada caso.
const nm = (n) => getNotifMeta(n, i18n.t);

describe("notifDomains", () => {
  describe("getDomain / getDomainMeta", () => {
    it("maps types to their domain", () => {
      expect(getDomain("chat")).toBe("mesa");
      expect(getDomain("friend_request")).toBe("amigo");
      expect(getDomain("compartida_like")).toBe("compartida");
      expect(getDomain("compartida_comment_like")).toBe("compartida");
      expect(getDomain("comment_like")).toBe("mesa");
      expect(getDomain("tournament_started")).toBe("torneo");
      expect(getDomain("evento_confirmed")).toBe("evento");
      expect(getDomain("admin_chat")).toBe("admin");
    });

    it("falls back to mesa for unknown types", () => {
      expect(getDomain("???")).toBe("mesa");
    });

    it("maps BG Watch shared-play types to the bgwatch domain", () => {
      expect(getDomain("bgg_play_shared")).toBe("bgwatch");
      expect(getDomain("bgg_play_accepted")).toBe("bgwatch");
      expect(getDomainLabel("bgg_play_shared", i18n.t)).toBe("BG Watch");
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
    it("los likes de comentario son agregables (count badge)", () => {
      expect(getCountBadge({ type: "compartida_comment_like", count: 3 })).toBe(
        3,
      );
      expect(getCountBadge({ type: "comment_like", count: 2 })).toBe(2);
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
      // Likes de comentario: deep-link al recurso contenedor.
      expect(
        notifLink({ type: "compartida_comment_like", compartidaId: "c1" }),
      ).toBe("/compartidas/c1");
      expect(notifLink({ type: "comment_like", tableId: "tb1" })).toBe(
        "/mesas/tb1",
      );
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
        nm({
          type: "join_request",
          count: 1,
          lastRequesterUsername: "lu",
        }).title,
      ).toMatch(/lu quiere unirse/i);
      expect(nm({ type: "join_request", count: 3 }).title).toMatch(
        /3 personas quieren unirse/i,
      );
    });

    it("comment usa copy neutral (no asume 'tu mesa') con el nombre de la mesa", () => {
      const single = nm({
        type: "comment",
        count: 1,
        lastCommenterUsername: "ana",
        tableName: "Catan",
      });
      // No debe decir "tu mesa" — el destinatario puede ser un participante
      // del hilo (respuestas), no el host.
      expect(single.title).not.toMatch(/tu mesa/i);
      expect(single.title).toMatch(/ana comentó la mesa de Catan/i);

      const many = nm({
        type: "comment",
        count: 4,
        tableName: "Catan",
      });
      expect(many.title).toMatch(/4 comentarios nuevos en la mesa de Catan/i);
    });

    it("compartida_like aggregates names with count", () => {
      const meta = nm({
        type: "compartida_like",
        count: 8,
        lastSenderUsername: "cami",
      });
      expect(meta.title).toMatch(/cami y 7 más/i);
    });

    it("compartida_like: count 0 (post mark-as-read) still renders singular, not 'y -1 más'", () => {
      const meta = nm({
        type: "compartida_like",
        count: 0,
        lastSenderUsername: "cami",
      });
      expect(meta.title).toMatch(/a cami le gustó tu compartida/i);
      expect(meta.title).not.toMatch(/-1/);
    });

    it("compartida_comment_like: copy de like de comentario (singular/plural)", () => {
      const single = nm({
        type: "compartida_comment_like",
        count: 1,
        lastSenderUsername: "ana",
        compartidaTitle: "Mi noche",
      });
      expect(single.title).toMatch(/a ana le gustó tu comentario/i);
      expect(single.body).toMatch(/«Mi noche»/);
      expect(single.cta).toBe("Ver compartida");

      const many = nm({
        type: "compartida_comment_like",
        count: 5,
        lastSenderUsername: "ana",
      });
      expect(many.title).toMatch(/ana y 4 más/i);
    });

    it("comment_like: copy de like de comentario de mesa", () => {
      const meta = nm({
        type: "comment_like",
        count: 1,
        lastSenderUsername: "beto",
        tableName: "Catan",
      });
      expect(meta.title).toMatch(/a beto le gustó tu comentario/i);
      expect(meta.body).toMatch(/en la mesa de Catan/i);
      expect(meta.cta).toBe("Ver mesa");
    });

    it("returns a cta for navigable types and null where destructive", () => {
      expect(nm({ type: "evento_confirmed" }).cta).toBeTruthy();
      expect(nm({ type: "table_cancelled" }).cta).toBeNull();
    });

    it("has a safe default for unknown types", () => {
      const meta = nm({ type: "mystery" });
      expect(meta.title).toBeTruthy();
    });

    it("community copy: request (singular/plural), accepted, rejected", () => {
      expect(
        nm({
          type: "community_join_request",
          count: 1,
          communityName: "Rosario Juega",
          actors: [{ username: "ana" }],
        }).title,
      ).toMatch(/ana quiere unirse a Rosario Juega/i);
      expect(
        nm({
          type: "community_join_request",
          count: 3,
          communityName: "Rosario Juega",
        }).title,
      ).toMatch(/3 solicitudes/i);
      expect(
        nm({
          type: "community_join_accepted",
          communityName: "Rosario Juega",
        }).body,
      ).toMatch(/ya sos parte de Rosario Juega/i);
      expect(nm({ type: "community_join_rejected" }).title).toMatch(
        /rechazada/i,
      );
    });

    it("BG Watch copy: shared (incluye autor + juego) y accepted (gracias)", () => {
      const shared = nm({
        type: "bgg_play_shared",
        fromUsername: "ana",
        gameName: "Catán",
      });
      expect(shared.title).toMatch(/ana/i);
      expect(shared.body).toMatch(/Catán/);
      expect(shared.cta).toBeTruthy();
      const accepted = nm({
        type: "bgg_play_accepted",
        fromUsername: "bob",
        gameName: "Catán",
      });
      expect(accepted.title).toMatch(/bob cargó tu partida/i);
    });
  });

  describe("comunidades domain", () => {
    it("maps community types to the comunidad domain", () => {
      expect(getDomain("community_join_request")).toBe("comunidad");
      expect(getDomain("community_join_accepted")).toBe("comunidad");
      expect(getDomainMeta("community_join_accepted").icon).toBe("Community");
    });

    it("join_request shows a count badge when aggregated", () => {
      expect(getCountBadge({ type: "community_join_request", count: 3 })).toBe(
        3,
      );
      expect(
        getCountBadge({ type: "community_join_accepted", count: 5 }),
      ).toBeNull();
    });

    it("links request to gestión and resolutions to the community detail", () => {
      expect(
        notifLink({
          type: "community_join_request",
          communitySlug: "rosario-juega",
        }),
      ).toBe("/comunidades/rosario-juega/gestion");
      expect(
        notifLink({
          type: "community_join_accepted",
          communitySlug: "rosario-juega",
        }),
      ).toBe("/comunidades/rosario-juega");
      expect(notifLink({ type: "community_join_accepted" })).toBe(
        "/comunidades",
      );
    });

    it("notifTarget returns the community name", () => {
      expect(
        notifTarget({
          type: "community_join_accepted",
          communityName: "Rosario Juega",
        }),
      ).toBe("Rosario Juega");
    });
  });

  describe("i18n (English render)", () => {
    // El singleton arranca en español (test setup); volvemos a dejarlo así para
    // no contaminar otros tests del mismo proceso.
    afterEach(() => i18n.changeLanguage("es"));

    it("renders titles/body/cta + domain label in English", () => {
      i18n.changeLanguage("en");

      // Plural con count + username.
      expect(
        getNotifMeta(
          { type: "join_request", count: 1, lastRequesterUsername: "lu" },
          i18n.t,
        ).title,
      ).toBe("lu wants to join your table");
      expect(
        getNotifMeta({ type: "join_request", count: 3 }, i18n.t).title,
      ).toBe("3 people want to join your table");

      // "y N más" → "and N others".
      expect(
        getNotifMeta(
          { type: "compartida_like", count: 8, lastSenderUsername: "cami" },
          i18n.t,
        ).title,
      ).toBe("cami and 7 others liked your shared post");

      // body + cta.
      const ev = getNotifMeta(
        { type: "evento_confirmed", eventoTitle: "Jornada" },
        i18n.t,
      );
      expect(ev.body).toBe("You're in Jornada");
      expect(ev.cta).toBe("View event");

      // Domain label.
      expect(getDomainLabel("chat", i18n.t)).toBe("Tables");
    });
  });
});

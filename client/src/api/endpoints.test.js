import { describe, it, expect } from "vitest";
import { API } from "./endpoints";

describe("API constants", () => {
  it("auth paths son strings literales conocidos", () => {
    expect(API.auth.LOGIN).toBe("/api/auth/login");
    expect(API.auth.ME).toBe("/api/auth/me");
    expect(API.auth.AVATAR).toBe("/api/auth/avatar");
    expect(API.auth.BGG_CONNECT).toBe("/api/auth/bgg-connect");
  });

  it("notifications, siteConfig, geocode, health son strings simples", () => {
    expect(API.notifications.LIST).toBe("/api/notifications");
    expect(API.notifications.READ).toBe("/api/notifications/read");
    expect(API.siteConfig).toBe("/api/site-config");
    expect(API.geocode).toBe("/api/geocode");
    expect(API.health).toBe("/api/health");
  });
});

describe("API builders — paths con params", () => {
  it("tables.DETAIL embebe el id", () => {
    expect(API.tables.DETAIL("abc123")).toBe("/api/tables/abc123");
  });

  it("tables paths anidados arman el subpath correcto", () => {
    expect(API.tables.JOIN("t1")).toBe("/api/tables/t1/join");
    expect(API.tables.MESSAGES("t1")).toBe("/api/tables/t1/messages");
    expect(API.tables.REQUEST_ACCEPT("t1", "u2")).toBe(
      "/api/tables/t1/requests/u2/accept",
    );
    expect(API.tables.COMMENT_DETAIL("t1", "c5")).toBe(
      "/api/tables/t1/comments/c5",
    );
  });

  it("bgg.PARTIDAS encodea bggUsernames con caracteres especiales", () => {
    expect(API.bgg.PARTIDAS("claudio")).toBe("/api/bgg/partidas/claudio");
    expect(API.bgg.PARTIDAS("juan pérez")).toBe(
      "/api/bgg/partidas/juan%20p%C3%A9rez",
    );
    // Slash debe quedar encoded para no romper el routing del server.
    expect(API.bgg.PARTIDAS("a/b")).toBe("/api/bgg/partidas/a%2Fb");
  });

  it("bgg.GAME y JUEGOS_JUGADOS son builders", () => {
    expect(API.bgg.GAME(42)).toBe("/api/bgg/game/42");
    expect(API.bgg.JUEGOS_JUGADOS("alice")).toBe(
      "/api/bgg/juegos-jugados/alice",
    );
  });

  it("compartidas paths anidados", () => {
    expect(API.compartidas.LIKE("c1")).toBe("/api/compartidas/c1/like");
    expect(API.compartidas.COMMENT_DETAIL("c1", "cm2")).toBe(
      "/api/compartidas/c1/comments/cm2",
    );
    expect(API.compartidas.IMAGE_DETAIL("c1", "img3")).toBe(
      "/api/compartidas/c1/images/img3",
    );
  });

  it("torneos paths con multiples params", () => {
    expect(API.torneos.MATCH_RESULT("t1", "m5")).toBe(
      "/api/torneos/t1/matches/m5/result",
    );
    expect(API.torneos.GROUP_ADVANCED("t1", "g2")).toBe(
      "/api/torneos/t1/groups/g2/advanced",
    );
    expect(API.torneos.NEXT_PHASE_PREVIEW("t1")).toBe(
      "/api/torneos/t1/next-phase/preview",
    );
  });

  it("eventos paths de inscripción", () => {
    expect(API.eventos.INSCRIBIRSE("e1")).toBe("/api/eventos/e1/inscribirse");
    expect(API.eventos.INSCRIPCION_CONFIRMAR("e1", "u2")).toBe(
      "/api/eventos/e1/inscripciones/u2/confirmar",
    );
    expect(API.eventos.INSCRIPCION_RECHAZAR("e1", "u2")).toBe(
      "/api/eventos/e1/inscripciones/u2/rechazar",
    );
  });

  it("friends paths", () => {
    expect(API.friends.REQUEST("u1")).toBe("/api/friends/u1/request");
    expect(API.friends.ACCEPT("u1")).toBe("/api/friends/u1/accept");
    expect(API.friends.UNFRIEND("u1")).toBe("/api/friends/u1");
  });

  it("dm paths", () => {
    expect(API.dm.HISTORY("u1")).toBe("/api/dm/u1");
    expect(API.dm.READ("u1")).toBe("/api/dm/u1/read");
  });

  it("users y admin paths", () => {
    expect(API.users.DETAIL("u1")).toBe("/api/users/u1");
    expect(API.admin.COLLECTION_DETAIL("tables")).toBe(
      "/api/admin/collections/tables",
    );
    expect(API.admin.COLLECTION_DETAIL("bgg games")).toBe(
      "/api/admin/collections/bgg%20games",
    );
  });

  it("noticias.DETAIL", () => {
    expect(API.noticias.DETAIL("n1")).toBe("/api/noticias/n1");
  });
});

describe("API structural sanity", () => {
  it("ningún path empieza con duplicado /api/api/", () => {
    function walk(obj) {
      const errors = [];
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "string") {
          if (v.startsWith("/api/api/")) errors.push(`${k}: ${v}`);
          if (!v.startsWith("/api/")) errors.push(`${k}: ${v}`);
        } else if (typeof v === "function") {
          // Llamamos al builder con un valor dummy para inspeccionar la forma.
          const path = v("x");
          if (path.startsWith("/api/api/")) errors.push(`${k}(): ${path}`);
          if (!path.startsWith("/api/")) errors.push(`${k}(): ${path}`);
        } else if (typeof v === "object" && v !== null) {
          errors.push(...walk(v));
        }
      }
      return errors;
    }
    expect(walk(API)).toEqual([]);
  });
});

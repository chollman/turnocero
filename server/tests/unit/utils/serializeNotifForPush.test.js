const serializeNotifForPush = require("../../../utils/serializeNotifForPush");

// Helper: simula un doc Mongoose con .toObject()
function asDoc(obj) {
  return { toObject: () => obj };
}

describe("utils/serializeNotifForPush", () => {
  it("incluye los campos whitelisted que lee el copy del SW", () => {
    const out = serializeNotifForPush(
      asDoc({
        _id: "abc123",
        type: "dm",
        count: 3,
        fromUserId: "u2",
        fromUsername: "Ana",
        lastMessagePreview: "hola",
      }),
    );
    expect(out).toMatchObject({
      notifId: "abc123",
      type: "dm",
      count: 3,
      fromUserId: "u2",
      fromUsername: "Ana",
      lastMessagePreview: "hola",
    });
  });

  it("convierte el _id a string en notifId", () => {
    const out = serializeNotifForPush(asDoc({ _id: 12345, type: "chat" }));
    expect(out.notifId).toBe("12345");
    expect(typeof out.notifId).toBe("string");
  });

  it("excluye campos no whitelisted (playSnapshot, community, _id crudo)", () => {
    const out = serializeNotifForPush(
      asDoc({
        _id: "x",
        type: "bgg_play_shared",
        gameName: "Catan",
        playSnapshot: { huge: "a".repeat(5000) },
        community: "comm-1",
        someRandomField: "nope",
      }),
    );
    expect(out.gameName).toBe("Catan");
    expect(out.playSnapshot).toBeUndefined();
    expect(out.community).toBeUndefined();
    expect(out.someRandomField).toBeUndefined();
    expect(out._id).toBeUndefined();
  });

  it("omite campos null/undefined", () => {
    const out = serializeNotifForPush(
      asDoc({ _id: "x", type: "chat", tableName: null, tableId: undefined }),
    );
    expect(out).not.toHaveProperty("tableName");
    expect(out).not.toHaveProperty("tableId");
  });

  it("recorta actors a 3 y deja solo el username", () => {
    const out = serializeNotifForPush(
      asDoc({
        _id: "x",
        type: "community_join_request",
        actors: [
          { userId: "1", username: "a", extra: "drop" },
          { userId: "2", username: "b" },
          { userId: "3", username: "c" },
          { userId: "4", username: "d" },
        ],
      }),
    );
    expect(out.actors).toHaveLength(3);
    expect(out.actors[0]).toEqual({ username: "a" });
    expect(out.actors[0].userId).toBeUndefined();
  });

  it("no setea actors si el array está vacío o ausente", () => {
    expect(serializeNotifForPush(asDoc({ _id: "x", type: "chat" }))).not.toHaveProperty(
      "actors",
    );
    expect(
      serializeNotifForPush(asDoc({ _id: "x", type: "chat", actors: [] })),
    ).not.toHaveProperty("actors");
  });

  it("acepta un objeto plano (sin toObject)", () => {
    const out = serializeNotifForPush({ _id: "p1", type: "friend_request" });
    expect(out).toEqual({ notifId: "p1", type: "friend_request" });
  });

  it("mantiene el payload bien por debajo de 4KB en el peor caso", () => {
    const worst = asDoc({
      _id: "0".repeat(24),
      type: "evento_updated",
      count: 99,
      tableName: "x".repeat(120),
      eventoTitle: "y".repeat(120),
      compartidaTitle: "z".repeat(120),
      torneoTitle: "t".repeat(120),
      communityName: "c".repeat(120),
      lastMessagePreview: "m".repeat(200),
      lastCommentPreview: "n".repeat(200),
      changedFields: ["eventDate", "location"],
      actors: [
        { username: "a".repeat(40) },
        { username: "b".repeat(40) },
        { username: "c".repeat(40) },
      ],
    });
    const size = JSON.stringify(serializeNotifForPush(worst)).length;
    expect(size).toBeLessThan(4096);
  });
});

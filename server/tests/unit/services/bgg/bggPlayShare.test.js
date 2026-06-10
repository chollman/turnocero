const {
  buildSnapshot,
  notifyPlayParticipants,
  acknowledgeSharedPlay,
} = require("../../../../services/bgg/bggPlayShare");
const Notification = require("../../../../models/Notification");
const BggGame = require("../../../../models/BggGame");
const { createUser } = require("../../../helpers/auth");

// Fake Socket.IO server: captura los emits sin red.
function makeReq() {
  const emit = vi.fn();
  const io = { to: vi.fn(() => ({ emit })) };
  const req = { app: { get: (k) => (k === "io" ? io : undefined) } };
  return { req, io, emit };
}

const baseBody = {
  objectid: 13,
  playdate: "2026-06-06",
  length: 90,
  location: "Casa de Claudio",
  quantity: 1,
  comments: "Gran partida",
  incomplete: false,
  nowinstats: false,
  players: [
    { name: "Alice", username: "alice", position: 1, score: "42", win: true },
    { name: "Bob", username: "bob", position: 2, score: "30", win: false },
    { name: "Invitado", username: "", score: "10", win: false },
  ],
};

describe("bggPlayShare", () => {
  describe("buildSnapshot", () => {
    it("maps body + game + playId into the snapshot shape", () => {
      const snap = buildSnapshot(
        baseBody,
        { name: "Catan", thumbnail: "t.jpg", image: "i.jpg" },
        "999",
      );
      expect(snap).toMatchObject({
        playId: "999",
        gameId: "13",
        gameName: "Catan",
        gameThumbnail: "t.jpg",
        gameImage: "i.jpg",
        date: "2026-06-06",
        duration: 90,
        quantity: 1,
      });
      // La ubicación es privada del autor: nunca se incluye en el snapshot.
      expect(snap.location).toBeUndefined();
      expect(snap.players).toHaveLength(3);
      expect(snap.players[0]).toMatchObject({
        name: "Alice",
        username: "alice",
        score: "42",
        win: true,
      });
    });

    it("tolerates a missing game and empty fields", () => {
      const snap = buildSnapshot(
        { objectid: 5, playdate: "2026-01-01", players: [] },
        null,
        "1",
      );
      expect(snap.gameName).toBe("");
      expect(snap.gameThumbnail).toBe("");
      expect(snap.duration).toBeNull();
      expect(snap.players).toEqual([]);
    });
  });

  describe("notifyPlayParticipants", () => {
    it("notifies co-players who are TurnoCero users, excluding the author", async () => {
      const alice = await createUser({
        username: "alice_tc",
        bggUsername: "alice",
      });
      const bob = await createUser({ username: "bob_tc", bggUsername: "bob" });
      // Juego pre-seedeado → resolveGame sale de Mongo (sin fetch a BGG).
      await BggGame.create({
        gameId: 13,
        name: "Catan",
        thumbnail: "t.jpg",
        image: "i.jpg",
        playingTime: null,
      });
      const { req, emit } = makeReq();

      await notifyPlayParticipants({
        req,
        author: alice,
        body: baseBody,
        playId: "999",
      });

      // Bob recibe la notif; Alice (autora) NO; el invitado sin username tampoco.
      const all = await Notification.find({ type: "bgg_play_shared" }).lean();
      expect(all).toHaveLength(1);
      const notif = all[0];
      expect(String(notif.recipient)).toBe(String(bob._id));
      expect(notif.fromUserId).toBe(String(alice._id));
      expect(notif.playId).toBe("999");
      expect(notif.gameName).toBe("Catan");
      expect(notif.playSnapshot.players).toHaveLength(3);
      expect(notif.playSnapshot.gameImage).toBe("i.jpg");
      // Se emitió por socket a la room de Bob.
      expect(emit).toHaveBeenCalledWith(
        "bgg:play-shared",
        expect.objectContaining({ playId: "999", notifId: expect.any(String) }),
      );
    });

    it("does nothing when no player matches a TurnoCero user", async () => {
      const alice = await createUser({ bggUsername: "alice" });
      const { req } = makeReq();
      await notifyPlayParticipants({
        req,
        author: alice,
        body: {
          objectid: 13,
          playdate: "2026-06-06",
          players: [{ name: "Random", username: "nobody-here" }],
        },
        playId: "1",
      });
      const all = await Notification.find({ type: "bgg_play_shared" }).lean();
      expect(all).toHaveLength(0);
    });
  });

  describe("acknowledgeSharedPlay", () => {
    it("thanks the author and marks the shared notif as loaded (does not delete it)", async () => {
      const alice = await createUser({ bggUsername: "alice" });
      const bob = await createUser({
        username: "bob_tc",
        displayName: "Bob",
        bggUsername: "bob",
      });
      const shared = await Notification.create({
        recipient: bob._id,
        type: "bgg_play_shared",
        fromUserId: String(alice._id),
        fromUsername: "alice_tc",
        playId: "999",
        gameName: "Catan",
        playSnapshot: { playId: "999", gameId: "13", players: [] },
      });
      const { req, emit } = makeReq();

      const result = await acknowledgeSharedPlay({
        req,
        recipient: bob,
        notifId: shared._id,
      });

      expect(result).toBeTruthy();
      // La notif original (a Bob) NO se borra: queda como notif común, leída y
      // marcada como cargada (sin botones de acción en la tarjeta).
      const after = await Notification.findById(shared._id).lean();
      expect(after).toBeTruthy();
      expect(after.read).toBe(true);
      expect(after.playLoaded).toBe(true);
      expect(after.count).toBe(0);
      // Alice recibe el agradecimiento.
      const thanks = await Notification.findOne({
        type: "bgg_play_accepted",
      }).lean();
      expect(thanks).toBeTruthy();
      expect(String(thanks.recipient)).toBe(String(alice._id));
      expect(thanks.fromUserId).toBe(String(bob._id));
      expect(thanks.playId).toBe("999");
      expect(emit).toHaveBeenCalledWith(
        "bgg:play-accepted",
        expect.objectContaining({ playId: "999" }),
      );
    });

    it("is idempotent: a second call on an already-loaded notif does not re-thank", async () => {
      const alice = await createUser({ bggUsername: "alice" });
      const bob = await createUser({ bggUsername: "bob" });
      const shared = await Notification.create({
        recipient: bob._id,
        type: "bgg_play_shared",
        fromUserId: String(alice._id),
        playId: "999",
        playSnapshot: { playId: "999", gameId: "13", players: [] },
      });
      const { req } = makeReq();

      await acknowledgeSharedPlay({ req, recipient: bob, notifId: shared._id });
      // Segunda carga (POST stale): no-op, no se genera otro agradecimiento.
      const second = await acknowledgeSharedPlay({
        req,
        recipient: bob,
        notifId: shared._id,
      });
      expect(second).toBeNull();
      expect(
        await Notification.countDocuments({ type: "bgg_play_accepted" }),
      ).toBe(1);
    });

    it("is a no-op for an invalid notifId", async () => {
      const bob = await createUser({ bggUsername: "bob" });
      const { req } = makeReq();
      const result = await acknowledgeSharedPlay({
        req,
        recipient: bob,
        notifId: "not-an-objectid",
      });
      expect(result).toBeNull();
      expect(await Notification.countDocuments()).toBe(0);
    });

    it("is a no-op when the notif does not belong to the recipient", async () => {
      const alice = await createUser({ bggUsername: "alice" });
      const bob = await createUser({ bggUsername: "bob" });
      const carol = await createUser({ bggUsername: "carol" });
      const shared = await Notification.create({
        recipient: bob._id,
        type: "bgg_play_shared",
        fromUserId: String(alice._id),
        playId: "999",
      });
      const { req } = makeReq();
      // Carol intenta aceptar la notif de Bob → no-op, no se borra.
      const result = await acknowledgeSharedPlay({
        req,
        recipient: carol,
        notifId: shared._id,
      });
      expect(result).toBeNull();
      expect(await Notification.findById(shared._id)).toBeTruthy();
      expect(
        await Notification.countDocuments({ type: "bgg_play_accepted" }),
      ).toBe(0);
    });
  });
});

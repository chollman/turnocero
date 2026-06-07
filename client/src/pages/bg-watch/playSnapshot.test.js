import { describe, it, expect } from "vitest";
import { snapshotToInitialValues } from "./playSnapshot";

describe("snapshotToInitialValues", () => {
  it("maps a snapshot to PlayForm initialValues", () => {
    const iv = snapshotToInitialValues({
      gameId: "13",
      gameName: "Catán",
      gameThumbnail: "t.jpg",
      gameImage: "i.jpg",
      date: "2026-05-20",
      duration: 90,
      location: "Club",
      quantity: 1,
      comments: "linda",
      incomplete: false,
      nowinstats: true,
      players: [
        { name: "Ana", username: "ana", score: 42, win: true, new: false },
        { name: "Bob", username: "bob", score: "30", win: false, new: true },
      ],
    });
    expect(iv.game).toEqual({ id: "13", name: "Catán", thumbnail: "t.jpg" });
    expect(iv.details).toMatchObject({
      playdate: "2026-05-20",
      length: "90",
      // La ubicación no se replica de una partida compartida.
      location: "",
      quantity: 1,
      comments: "linda",
      incomplete: false,
      nowinstats: true,
    });
    expect(iv.players).toEqual([
      { name: "Ana", username: "ana", score: "42", win: true, new: false },
      { name: "Bob", username: "bob", score: "30", win: false, new: true },
    ]);
  });

  it("falls back to image when thumbnail is missing and tolerates empties", () => {
    const iv = snapshotToInitialValues({
      gameId: "5",
      gameImage: "only-image.jpg",
      players: [],
    });
    expect(iv.game.thumbnail).toBe("only-image.jpg");
    expect(iv.details.length).toBe("");
    expect(iv.details.quantity).toBe(1);
    expect(iv.players).toEqual([]);
  });

  it("does not throw on null/undefined snapshot", () => {
    expect(() => snapshotToInitialValues(null)).not.toThrow();
    expect(snapshotToInitialValues(undefined).players).toEqual([]);
  });
});

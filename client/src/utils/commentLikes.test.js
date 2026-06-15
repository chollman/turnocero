import { describe, it, expect } from "vitest";
import { patchCommentInTree, toggleLikePatch } from "./commentLikes";

const tree = () => [
  { _id: "a", likeCount: 0, liked: false, replies: [] },
  {
    _id: "b",
    likeCount: 2,
    liked: false,
    replies: [
      { _id: "b1", likeCount: 0, liked: false },
      { _id: "b2", likeCount: 5, liked: true },
    ],
  },
];

describe("patchCommentInTree", () => {
  it("aplica el patch a un comentario top-level", () => {
    const out = patchCommentInTree(tree(), "a", { liked: true, likeCount: 1 });
    expect(out[0]).toMatchObject({ _id: "a", liked: true, likeCount: 1 });
    // No toca los demás.
    expect(out[1]._id).toBe("b");
  });

  it("aplica el patch a una respuesta anidada", () => {
    const out = patchCommentInTree(tree(), "b2", {
      liked: false,
      likeCount: 4,
    });
    expect(out[1].replies[1]).toMatchObject({
      _id: "b2",
      liked: false,
      likeCount: 4,
    });
    // La otra respuesta queda intacta.
    expect(out[1].replies[0]._id).toBe("b1");
  });

  it("no muta el array original (inmutable)", () => {
    const original = tree();
    const out = patchCommentInTree(original, "a", { liked: true });
    expect(original[0].liked).toBe(false);
    expect(out).not.toBe(original);
  });

  it("devuelve el árbol intacto si el id no existe", () => {
    const out = patchCommentInTree(tree(), "zzz", { liked: true });
    expect(out[0].liked).toBe(false);
    expect(out[1].replies[1].liked).toBe(true);
  });
});

describe("toggleLikePatch", () => {
  it("de no-liked a liked: +1", () => {
    expect(toggleLikePatch({ liked: false, likeCount: 3 })).toEqual({
      liked: true,
      likeCount: 4,
    });
  });

  it("de liked a no-liked: -1", () => {
    expect(toggleLikePatch({ liked: true, likeCount: 3 })).toEqual({
      liked: false,
      likeCount: 2,
    });
  });

  it("clampa el count a 0 (no baja de cero)", () => {
    expect(toggleLikePatch({ liked: true, likeCount: 0 })).toEqual({
      liked: false,
      likeCount: 0,
    });
  });

  it("trata likeCount/liked indefinidos como 0/false", () => {
    expect(toggleLikePatch({})).toEqual({ liked: true, likeCount: 1 });
  });
});

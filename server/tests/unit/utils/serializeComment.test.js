const mongoose = require("mongoose");
const serializeComment = require("../../../utils/serializeComment");

const oid = () => new mongoose.Types.ObjectId();

describe("serializeComment", () => {
  it("expone likeCount y liked, y quita el array crudo `likes`", () => {
    const me = oid();
    const other = oid();
    const comment = {
      _id: oid(),
      content: "hola",
      likes: [other, me],
    };
    const out = serializeComment(comment, me);
    expect(out.likeCount).toBe(2);
    expect(out.liked).toBe(true);
    expect(out.likes).toBeUndefined();
    expect(out.content).toBe("hola");
  });

  it("liked=false si el usuario no está entre los likes", () => {
    const me = oid();
    const out = serializeComment({ _id: oid(), likes: [oid()] }, me);
    expect(out.liked).toBe(false);
    expect(out.likeCount).toBe(1);
  });

  it("liked=false y likeCount=0 para anónimo / sin likes", () => {
    const out = serializeComment({ _id: oid(), likes: [] }, null);
    expect(out.liked).toBe(false);
    expect(out.likeCount).toBe(0);
  });

  it("soporta documentos Mongoose (usa toObject)", () => {
    const me = oid();
    const doc = {
      toObject: () => ({ _id: oid(), content: "x", likes: [me] }),
    };
    const out = serializeComment(doc, me);
    expect(out.liked).toBe(true);
    expect(out.likeCount).toBe(1);
  });

  it("tolera un comentario sin campo likes", () => {
    const out = serializeComment({ _id: oid(), content: "x" }, oid());
    expect(out.likeCount).toBe(0);
    expect(out.liked).toBe(false);
  });
});

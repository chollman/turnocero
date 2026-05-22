const mongoose = require("mongoose");
const { isSameId } = require("../../../utils/idCompare");

describe("isSameId", () => {
  it("compara dos strings iguales como true", () => {
    expect(isSameId("507f1f77bcf86cd799439011", "507f1f77bcf86cd799439011")).toBe(true);
  });

  it("compara dos strings distintos como false", () => {
    expect(isSameId("507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012")).toBe(false);
  });

  it("compara ObjectId vs string del mismo valor como true", () => {
    const id = new mongoose.Types.ObjectId();
    expect(isSameId(id, id.toString())).toBe(true);
    expect(isSameId(id.toString(), id)).toBe(true);
  });

  it("compara dos ObjectId del mismo valor como true", () => {
    const a = new mongoose.Types.ObjectId("507f1f77bcf86cd799439011");
    const b = new mongoose.Types.ObjectId("507f1f77bcf86cd799439011");
    expect(isSameId(a, b)).toBe(true);
  });

  it("devuelve false si alguno es null o undefined", () => {
    expect(isSameId(null, "abc")).toBe(false);
    expect(isSameId("abc", null)).toBe(false);
    expect(isSameId(undefined, "abc")).toBe(false);
    expect(isSameId(null, null)).toBe(false);
    expect(isSameId(undefined, undefined)).toBe(false);
  });
});

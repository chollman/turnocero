import { describe, it, expect } from "vitest";
import { getUserDisplay, DELETED_USER_LABEL } from "./userDisplay";

describe("getUserDisplay", () => {
  it("returns isDeleted when user is null", () => {
    const r = getUserDisplay(null);
    expect(r.isDeleted).toBe(true);
    expect(r.name).toBe(DELETED_USER_LABEL);
    expect(r.avatar).toEqual({ url: "", publicId: "" });
  });

  it("returns isDeleted when user is undefined", () => {
    expect(getUserDisplay(undefined).isDeleted).toBe(true);
  });

  it("returns isDeleted when user has no _id", () => {
    const r = getUserDisplay({ username: "orphan" });
    expect(r.isDeleted).toBe(true);
  });

  it("uses displayName when present", () => {
    const r = getUserDisplay({
      _id: "a",
      username: "cha",
      displayName: "Claudio Hollman",
    });
    expect(r.isDeleted).toBe(false);
    expect(r.name).toBe("Claudio Hollman");
  });

  it("falls back to nombre + apellido when displayName empty", () => {
    const r = getUserDisplay({
      _id: "a",
      username: "cha",
      displayName: "",
      nombre: "Claudio",
      apellido: "Hollman",
    });
    expect(r.name).toBe("Claudio Hollman");
  });

  it("falls back to username when nothing else", () => {
    const r = getUserDisplay({ _id: "a", username: "cha" });
    expect(r.name).toBe("cha");
  });

  it("normalizes legacy string avatar to { url, publicId }", () => {
    const r = getUserDisplay({
      _id: "a",
      username: "cha",
      avatar: "https://x.com/y.jpg",
    });
    expect(r.avatar).toEqual({ url: "https://x.com/y.jpg", publicId: "" });
  });

  it("passes through new-shape avatar", () => {
    const av = { url: "https://x.com/y.webp", publicId: "users/a/avatar" };
    const r = getUserDisplay({ _id: "a", username: "cha", avatar: av });
    expect(r.avatar).toEqual(av);
  });

  it("defaults missing avatar to empty shape", () => {
    const r = getUserDisplay({ _id: "a", username: "cha" });
    expect(r.avatar).toEqual({ url: "", publicId: "" });
  });

  it("preserves username and displayName for downstream consumers (e.g. <Avatar>)", () => {
    const r = getUserDisplay({
      _id: "a",
      username: "cha",
      displayName: "Claudio H",
    });
    expect(r.username).toBe("cha");
    expect(r.displayName).toBe("Claudio H");
    expect(r._id).toBe("a");
  });
});

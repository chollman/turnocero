const User = require("../../../models/User");
const {
  baseUsernameFrom,
  generateUniqueUsername,
  findOrCreateOAuthUser,
} = require("../../../services/oauthService");

describe("oauthService.baseUsernameFrom", () => {
  it("slugifies a display name to lowercase alphanumeric", () => {
    expect(baseUsernameFrom("José Pérez")).toBe("joseperez");
  });

  it("derives from an email when no name", () => {
    expect(baseUsernameFrom("ana.lopez@gmail.com")).toBe("analopezgmailcom");
  });

  it("pads very short seeds to satisfy the 3-char minimum", () => {
    expect(baseUsernameFrom("a").length).toBeGreaterThanOrEqual(3);
    expect(baseUsernameFrom("")).toBe("jugador");
  });

  it("caps the base at 30 chars", () => {
    expect(baseUsernameFrom("x".repeat(60)).length).toBeLessThanOrEqual(30);
  });
});

describe("oauthService.generateUniqueUsername", () => {
  it("returns the base when free", async () => {
    expect(await generateUniqueUsername("Pedro")).toBe("pedro");
  });

  it("appends a numeric suffix when the base is taken", async () => {
    await User.create({
      username: "pedro",
      email: "pedro@x.com",
      password: "Password1",
    });
    expect(await generateUniqueUsername("Pedro")).toBe("pedro1");
  });

  it("keeps incrementing across multiple collisions", async () => {
    await User.create({
      username: "pedro",
      email: "pedro@x.com",
      password: "Password1",
    });
    await User.create({
      username: "pedro1",
      email: "pedro1@x.com",
      password: "Password1",
    });
    expect(await generateUniqueUsername("Pedro")).toBe("pedro2");
  });

  it("treats a different-cased existing username as taken", async () => {
    // A password account registered "Pedro" with capitals; the generated
    // lowercase "pedro" would collide ignoring case, so we must suffix.
    await User.create({
      username: "Pedro",
      email: "pedro@x.com",
      password: "Password1",
    });
    expect(await generateUniqueUsername("Pedro")).toBe("pedro1");
  });
});

describe("oauthService.findOrCreateOAuthUser", () => {
  it("creates a verified, password-less account on first login", async () => {
    const user = await findOrCreateOAuthUser({
      provider: "google",
      providerId: "g-123",
      email: "New@Example.com",
      name: "New User",
      picture: "https://pic/avatar.jpg",
    });
    expect(user.googleId).toBe("g-123");
    expect(user.email).toBe("new@example.com");
    expect(user.emailVerified).toBe(true);
    expect(user.password).toBeUndefined();
    expect(user.authProviders).toEqual(["google"]);
    expect(user.displayName).toBe("New User");
    expect(user.avatar.url).toBe("https://pic/avatar.jpg");
  });

  it("returns the same account on a second login (idempotent)", async () => {
    const first = await findOrCreateOAuthUser({
      provider: "google",
      providerId: "g-123",
      email: "x@example.com",
      name: "X",
    });
    const second = await findOrCreateOAuthUser({
      provider: "google",
      providerId: "g-123",
      email: "x@example.com",
      name: "X",
    });
    expect(second._id.toString()).toBe(first._id.toString());
    expect(await User.countDocuments()).toBe(1);
  });

  it("links the provider to an existing password account with the same email", async () => {
    const existing = await User.create({
      username: "existing",
      email: "link@example.com",
      password: "Password1",
      emailVerified: false,
    });
    const linked = await findOrCreateOAuthUser({
      provider: "google",
      providerId: "g-999",
      email: "Link@Example.com",
      name: "Whatever",
    });
    expect(linked._id.toString()).toBe(existing._id.toString());
    expect(linked.googleId).toBe("g-999");
    expect(linked.emailVerified).toBe(true);
    expect(linked.authProviders).toContain("google");
    expect(await User.countDocuments()).toBe(1);
  });

  it("supports facebook as a provider", async () => {
    const user = await findOrCreateOAuthUser({
      provider: "facebook",
      providerId: "fb-1",
      email: "fb@example.com",
      name: "FB User",
    });
    expect(user.facebookId).toBe("fb-1");
    expect(user.authProviders).toEqual(["facebook"]);
  });

  it("throws when provider or providerId is missing", async () => {
    await expect(
      findOrCreateOAuthUser({ provider: "google", email: "a@b.com" }),
    ).rejects.toThrow();
  });
});

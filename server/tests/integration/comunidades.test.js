const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../../app");
const Community = require("../../models/Community");
const User = require("../../models/User");
const Table = require("../../models/Table");
const Compartida = require("../../models/Compartida");
const {
  createUser,
  createAuthedUser,
  tokenFor,
  authHeader,
} = require("../helpers/auth");
const { createTable, createCompartida } = require("../helpers/factories");

const hasMembership = (user, communityId) =>
  user.communityMemberships.some(
    (m) => String(m.community) === String(communityId),
  );

describe("POST /api/comunidades — create", () => {
  it("admin creates a community (slug derived); a regular user is forbidden", async () => {
    const { token: adminToken } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .post("/api/comunidades")
      .set(authHeader(adminToken))
      .send({ name: "Rosario Juega", joinPolicy: "open" })
      .expect(201);
    expect(res.body.slug).toBe("rosario-juega");
    expect(res.body.joinPolicy).toBe("open");

    const { token: userToken } = await createAuthedUser();
    await request(app)
      .post("/api/comunidades")
      .set(authHeader(userToken))
      .send({ name: "Nope" })
      .expect(403);
  });
});

describe("GET /api/comunidades — directory", () => {
  it("lists communities with member counts and viewer status", async () => {
    await Community.create({ name: "Beta", slug: "beta", joinPolicy: "open" });
    const { token } = await createAuthedUser();
    await request(app)
      .post("/api/comunidades/beta/join")
      .set(authHeader(token))
      .expect(200);

    const res = await request(app)
      .get("/api/comunidades")
      .set(authHeader(token))
      .expect(200);
    const betaCard = res.body.comunidades.find((c) => c.slug === "beta");
    expect(betaCard.viewerStatus).toBe("member");
    expect(betaCard.memberCount).toBe(1);
    expect(betaCard.inviteCode).toBeUndefined();
  });
});

describe("POST /api/comunidades/:slug/join — policies", () => {
  it("open join adds the membership immediately", async () => {
    await Community.create({ name: "Abierta", slug: "abierta", joinPolicy: "open" });
    const { user, token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/comunidades/abierta/join")
      .set(authHeader(token))
      .expect(200);
    expect(res.body.status).toBe("joined");
    const reloaded = await User.findById(user._id);
    const beta = await Community.findOne({ slug: "abierta" });
    expect(hasMembership(reloaded, beta._id)).toBe(true);
  });

  it("code join requires the right invite code", async () => {
    await Community.create({
      name: "Cerrada",
      slug: "cerrada",
      joinPolicy: "code",
      inviteCode: "SECRET",
    });
    const { token } = await createAuthedUser();
    await request(app)
      .post("/api/comunidades/cerrada/join")
      .set(authHeader(token))
      .send({ code: "wrong" })
      .expect(403);
    await request(app)
      .post("/api/comunidades/cerrada/join")
      .set(authHeader(token))
      .send({ code: "SECRET" })
      .expect(200);
  });

  it("approval join creates a pending request, notifies the subadmin, and accept grants membership", async () => {
    const beta = await Community.create({
      name: "Aprob",
      slug: "aprob",
      joinPolicy: "approval",
    });
    const sub = await createUser({
      communityMemberships: [{ community: beta._id, role: "subadmin" }],
    });
    const { user: applicant, token } = await createAuthedUser();

    global.__ioStub.__reset();
    const res = await request(app)
      .post("/api/comunidades/aprob/join")
      .set(authHeader(token))
      .expect(200);
    expect(res.body.status).toBe("pending");
    const emitted = global.__ioStub.emitted.filter(
      (e) => e.event === "community:join-request",
    );
    expect(emitted.some((e) => e.room === `user:${sub._id}`)).toBe(true);

    const list = await request(app)
      .get("/api/comunidades/aprob/solicitudes")
      .set(authHeader(tokenFor(sub)))
      .expect(200);
    expect(list.body.solicitudes).toHaveLength(1);

    await request(app)
      .post(`/api/comunidades/aprob/solicitudes/${applicant._id}/aceptar`)
      .set(authHeader(tokenFor(sub)))
      .expect(200);
    const reloaded = await User.findById(applicant._id);
    expect(hasMembership(reloaded, beta._id)).toBe(true);
  });
});

describe("DELETE /api/comunidades/:slug/leave", () => {
  it("removes the membership; leaving the base community is forbidden", async () => {
    const beta = await Community.create({
      name: "Salir",
      slug: "salir",
      joinPolicy: "open",
    });
    const { user, token } = await createAuthedUser({
      communityMemberships: [{ community: beta._id, role: "member" }],
    });
    await request(app)
      .delete("/api/comunidades/salir/leave")
      .set(authHeader(token))
      .expect(200);
    const reloaded = await User.findById(user._id);
    expect(hasMembership(reloaded, beta._id)).toBe(false);

    const base = await Community.getBase();
    await request(app)
      .delete(`/api/comunidades/${base.slug}/leave`)
      .set(authHeader(token))
      .expect(403);
  });
});

describe("PUT /api/comunidades/preferencias", () => {
  it("validates viewing/skin against the user's memberships", async () => {
    const beta = await Community.create({
      name: "Pref",
      slug: "pref",
      joinPolicy: "open",
    });
    const { token } = await createAuthedUser({
      communityMemberships: [{ community: beta._id, role: "member" }],
    });

    // skin a una comunidad que no integra → 400
    await request(app)
      .put("/api/comunidades/preferencias")
      .set(authHeader(token))
      .send({ skin: new mongoose.Types.ObjectId().toString() })
      .expect(400);

    // viewing filtra los no-miembros; skin válido
    const res = await request(app)
      .put("/api/comunidades/preferencias")
      .set(authHeader(token))
      .send({
        viewing: [beta._id.toString(), new mongoose.Types.ObjectId().toString()],
        skin: beta._id.toString(),
      })
      .expect(200);
    expect(res.body.viewing.map(String)).toEqual([String(beta._id)]);
    expect(String(res.body.skin)).toBe(String(beta._id));
  });
});

describe("Subadmin management + moderation", () => {
  it("admin promotes a subadmin who can then expel a member", async () => {
    const beta = await Community.create({
      name: "Mod",
      slug: "mod",
      joinPolicy: "open",
    });
    const { token: adminToken } = await createAuthedUser({ isAdmin: true });
    const member = await createUser({
      communityMemberships: [{ community: beta._id, role: "member" }],
    });
    const sub = await createUser({
      communityMemberships: [{ community: beta._id, role: "member" }],
    });

    await request(app)
      .put(`/api/comunidades/mod/subadmins/${sub._id}`)
      .set(authHeader(adminToken))
      .send({ subadmin: true })
      .expect(200);
    const subReloaded = await User.findById(sub._id);
    expect(subReloaded.communityMemberships[0].role).toBe("subadmin");

    await request(app)
      .delete(`/api/comunidades/mod/miembros/${member._id}`)
      .set(authHeader(tokenFor(sub)))
      .expect(200);
    const memberReloaded = await User.findById(member._id);
    expect(hasMembership(memberReloaded, beta._id)).toBe(false);
  });

  it("a non-subadmin member cannot list join requests (403)", async () => {
    const beta = await Community.create({
      name: "Gate",
      slug: "gate",
      joinPolicy: "approval",
    });
    const { token } = await createAuthedUser({
      communityMemberships: [{ community: beta._id, role: "member" }],
    });
    await request(app)
      .get("/api/comunidades/gate/solicitudes")
      .set(authHeader(token))
      .expect(403);
  });
});

describe("DELETE /api/comunidades/:slug — guards + cascade", () => {
  it("blocks delete with content, reassigns to base, then deletes and purges user refs", async () => {
    const beta = await Community.create({
      name: "Del",
      slug: "del",
      joinPolicy: "open",
    });
    const { token: adminToken } = await createAuthedUser({ isAdmin: true });
    const owner = await createUser({
      communityMemberships: [{ community: beta._id, role: "member" }],
      communityPrefs: { viewing: [beta._id], skin: beta._id },
    });
    const table = await createTable(owner, { community: beta._id });

    await request(app)
      .delete("/api/comunidades/del")
      .set(authHeader(adminToken))
      .expect(409);

    await request(app)
      .post("/api/comunidades/del/reasignar-a-base")
      .set(authHeader(adminToken))
      .expect(200);
    const base = await Community.getBase();
    const movedTable = await Table.findById(table._id);
    expect(String(movedTable.community)).toBe(String(base._id));

    await request(app)
      .delete("/api/comunidades/del")
      .set(authHeader(adminToken))
      .expect(200);
    expect(await Community.findOne({ slug: "del" })).toBeNull();

    const ownerReloaded = await User.findById(owner._id);
    expect(hasMembership(ownerReloaded, beta._id)).toBe(false);
    expect(
      ownerReloaded.communityPrefs.viewing.some(
        (v) => String(v) === String(beta._id),
      ),
    ).toBe(false);
    expect(String(ownerReloaded.communityPrefs.skin)).toBe(String(base._id));

    await request(app)
      .delete(`/api/comunidades/${base.slug}`)
      .set(authHeader(adminToken))
      .expect(403);
  });
});

describe("GET /api/comunidades/mias", () => {
  it("returns the user's memberships (with role) and prefs", async () => {
    const beta = await Community.create({
      name: "Mias",
      slug: "mias-c",
      joinPolicy: "open",
    });
    const { token } = await createAuthedUser({
      communityMemberships: [{ community: beta._id, role: "subadmin" }],
      communityPrefs: { viewing: [beta._id], skin: beta._id },
    });
    const res = await request(app)
      .get("/api/comunidades/mias")
      .set(authHeader(token))
      .expect(200);
    expect(res.body.memberships).toHaveLength(1);
    expect(res.body.memberships[0].role).toBe("subadmin");
    expect(res.body.memberships[0].community.slug).toBe("mias-c");
  });
});

describe("Skin editing (PUT /skin, POST /logo)", () => {
  it("admin updates skin tokens (sanitized) + brand", async () => {
    await Community.create({ name: "Skinned", slug: "skinned", joinPolicy: "open" });
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .put("/api/comunidades/skinned/skin")
      .set(authHeader(token))
      .send({
        accents: { amber: "#e63946", bad: "red", evil: "url(x)" },
        neutralsDark: { bgCard: "#101010" },
        brandName: "Skinned Club",
        tagline: "Jugamos en Rosario",
      })
      .expect(200);
    expect(res.body.skin.accents.amber).toBe("#e63946");
    // valores no-color descartados por el sanitizer
    expect(res.body.skin.accents.bad).toBeUndefined();
    expect(res.body.skin.accents.evil).toBeUndefined();
    expect(res.body.skin.neutralsDark.bgCard).toBe("#101010");
    expect(res.body.skin.brandName).toBe("Skinned Club");
    expect(res.body.skin.tagline).toBe("Jugamos en Rosario");
  });

  it("rejects a non-admin editing the skin (403)", async () => {
    await Community.create({ name: "Sk2", slug: "sk2", joinPolicy: "open" });
    const { token } = await createAuthedUser();
    await request(app)
      .put("/api/comunidades/sk2/skin")
      .set(authHeader(token))
      .send({ brandName: "x" })
      .expect(403);
  });

  it("admin uploads a logo (light variant)", async () => {
    await Community.create({ name: "Logo", slug: "logo-c", joinPolicy: "open" });
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .post("/api/comunidades/logo-c/logo")
      .set(authHeader(token))
      .field("variant", "light")
      .attach("logo", Buffer.from("fakeimage"), {
        filename: "logo.png",
        contentType: "image/png",
      })
      .expect(200);
    expect(res.body.skin.logoLight.url).toBeTruthy();
  });
});

describe("Content moderation by a community subadmin", () => {
  it("a subadmin deletes a compartida in their community; the author is notified", async () => {
    const beta = await Community.create({
      name: "ModC",
      slug: "modc",
      joinPolicy: "open",
    });
    const author = await createUser({
      communityMemberships: [{ community: beta._id, role: "member" }],
    });
    const sub = await createUser({
      communityMemberships: [{ community: beta._id, role: "subadmin" }],
    });
    const post = await createCompartida(author, { community: beta._id });

    global.__ioStub.__reset();
    await request(app)
      .delete(`/api/compartidas/${post._id}`)
      .set(authHeader(tokenFor(sub)))
      .expect(200);
    expect(await Compartida.findById(post._id)).toBeNull();

    const emitted = global.__ioStub.emitted.filter(
      (e) => e.event === "community:content-removed",
    );
    expect(emitted.some((e) => e.room === `user:${author._id}`)).toBe(true);
  });

  it("a subadmin of another community cannot delete it (403)", async () => {
    const beta = await Community.create({
      name: "ModC2",
      slug: "modc2",
      joinPolicy: "open",
    });
    const other = await Community.create({
      name: "Other",
      slug: "other-c",
      joinPolicy: "open",
    });
    const author = await createUser({
      communityMemberships: [{ community: beta._id, role: "member" }],
    });
    const sub = await createUser({
      communityMemberships: [{ community: other._id, role: "subadmin" }],
    });
    const post = await createCompartida(author, { community: beta._id });

    await request(app)
      .delete(`/api/compartidas/${post._id}`)
      .set(authHeader(tokenFor(sub)))
      .expect(403);
  });

  it("the author can still delete their own compartida (no self-notification)", async () => {
    const beta = await Community.create({
      name: "ModC3",
      slug: "modc3",
      joinPolicy: "open",
    });
    const { user: author, token } = await createAuthedUser({
      communityMemberships: [{ community: beta._id, role: "member" }],
    });
    const post = await createCompartida(author, { community: beta._id });

    global.__ioStub.__reset();
    await request(app)
      .delete(`/api/compartidas/${post._id}`)
      .set(authHeader(token))
      .expect(200);
    const emitted = global.__ioStub.emitted.filter(
      (e) => e.event === "community:content-removed",
    );
    expect(emitted).toHaveLength(0);
  });
});

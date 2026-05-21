const request = require("supertest");
const app = require("../../app");
const Evento = require("../../models/Evento");
const { createUser, createAuthedUser, tokenFor } = require("../helpers/auth");
const { createEvento } = require("../helpers/factories");
const { loadSiteConfig, updateSiteConfig } = require("../../utils/siteConfig");
const cloudMock = require("../mocks/cloudinary");

async function ensureEventosSectionOn() {
  await loadSiteConfig();
  await updateSiteConfig({ eventos: { enabled: true } }, null, null);
}

beforeEach(async () => {
  await ensureEventosSectionOn();
});

describe("GET /api/eventos", () => {
  it("returns paginated open/closed eventos publicly", async () => {
    const admin = await createUser({ isAdmin: true });
    await createEvento(admin, { title: "Open A", status: "open" });
    await createEvento(admin, { title: "Closed B", status: "closed" });
    await createEvento(admin, { title: "Draft C", status: "draft" });

    const res = await request(app).get("/api/eventos");
    expect(res.status).toBe(200);
    expect(res.body.eventos.length).toBe(2);
    expect(res.body.eventos.map((e) => e.title).sort()).toEqual([
      "Closed B",
      "Open A",
    ]);
  });

  it("admins can see drafts when filtered explicitly", async () => {
    const admin = await createUser({ isAdmin: true });
    await createEvento(admin, { title: "Draft", status: "draft" });

    const res = await request(app)
      .get("/api/eventos?status=draft")
      .set("Authorization", `Bearer ${tokenFor(admin)}`);
    expect(res.status).toBe(200);
    expect(res.body.eventos.length).toBe(1);
    expect(res.body.eventos[0].status).toBe("draft");
  });

  it("non-admins cannot see drafts even via status filter", async () => {
    const admin = await createUser({ isAdmin: true });
    await createEvento(admin, { title: "Draft", status: "draft" });

    const res = await request(app).get("/api/eventos?status=draft");
    expect(res.body.eventos.length).toBe(0);
  });

  it("enriches each evento with registrationCount (regression: progressbar did not update on inscription)", async () => {
    const admin = await createUser({ isAdmin: true });
    const p1 = await createUser({ username: "player1" });
    const p2 = await createUser({ username: "player2" });
    const p3 = await createUser({ username: "player3" });

    await createEvento(admin, {
      title: "Evento con inscripciones",
      status: "open",
      maxParticipants: 10,
      registrations: [
        { user: p1._id, status: "pending", submittedAt: new Date() },
        { user: p2._id, status: "pending", submittedAt: new Date() },
        { user: p3._id, status: "confirmed", submittedAt: new Date() },
      ],
    });

    const res = await request(app).get("/api/eventos");
    expect(res.status).toBe(200);
    const evento = res.body.eventos.find(
      (e) => e.title === "Evento con inscripciones",
    );
    expect(evento.registrationCount).toEqual({
      total: 3,
      pending: 2,
      confirmed: 1,
    });
    expect(evento.registrations).toBeUndefined(); // not leaked to clients
  });

  it("includes the current user's userRegistration in each evento (logged-in only)", async () => {
    const admin = await createUser({ isAdmin: true });
    const me = await createUser({ username: "me_user" });
    const other = await createUser({ username: "other_user" });

    await createEvento(admin, {
      title: "Evento con mi inscripción",
      status: "open",
      registrations: [
        { user: me._id, status: "pending", submittedAt: new Date() },
        { user: other._id, status: "confirmed", submittedAt: new Date() },
      ],
    });

    const res = await request(app)
      .get("/api/eventos")
      .set("Authorization", `Bearer ${tokenFor(me)}`);
    expect(res.status).toBe(200);
    const evento = res.body.eventos[0];
    expect(evento.userRegistration).toBeTruthy();
    expect(evento.userRegistration.status).toBe("pending");
  });

  it("omits userRegistration for unauthenticated requests", async () => {
    const admin = await createUser({ isAdmin: true });
    await createEvento(admin, { title: "Anon list", status: "open" });

    const res = await request(app).get("/api/eventos");
    expect(res.body.eventos[0].userRegistration).toBeNull();
  });

  it("auto-closes open events whose eventDate is in the past", async () => {
    const admin = await createUser({ isAdmin: true });
    const pastDate = new Date(Date.now() - 7 * 86400000);
    const futureDate = new Date(Date.now() + 7 * 86400000);

    const stale = await createEvento(admin, {
      title: "Pasado abierto",
      status: "open",
      eventDate: pastDate,
    });
    const fresh = await createEvento(admin, {
      title: "Futuro abierto",
      status: "open",
      eventDate: futureDate,
    });
    const draftPast = await createEvento(admin, {
      title: "Draft pasado",
      status: "draft",
      eventDate: pastDate,
    });

    // List request triggers the sweep
    await request(app).get("/api/eventos");

    // Re-fetch from DB to confirm persistence
    const staleAfter = await Evento.findById(stale._id);
    const freshAfter = await Evento.findById(fresh._id);
    const draftPastAfter = await Evento.findById(draftPast._id);

    expect(staleAfter.status).toBe("closed"); // ← auto-closed
    expect(freshAfter.status).toBe("open"); // ← future event untouched
    expect(draftPastAfter.status).toBe("draft"); // ← drafts no auto-close
  });

  it("past open event no longer appears under ?status=open, only under ?status=closed", async () => {
    const admin = await createUser({ isAdmin: true });
    await createEvento(admin, {
      title: "Ayer abierto",
      status: "open",
      eventDate: new Date(Date.now() - 86400000),
    });

    // Trigger sweep
    await request(app).get("/api/eventos");

    const openList = await request(app).get("/api/eventos?status=open");
    expect(openList.body.eventos.map((e) => e.title)).not.toContain(
      "Ayer abierto",
    );

    const closedList = await request(app).get("/api/eventos?status=closed");
    expect(closedList.body.eventos.map((e) => e.title)).toContain(
      "Ayer abierto",
    );

    // "Todos" (sin filtro, admin) tampoco lo pierde
    const adminAll = await request(app)
      .get("/api/eventos")
      .set("Authorization", `Bearer ${tokenFor(admin)}`);
    expect(adminAll.body.eventos.map((e) => e.title)).toContain("Ayer abierto");
  });
});

describe("PUT /api/eventos/:id", () => {
  it("partial update preserves untouched fields (regression: cancel was clobbering eventDate, description, etc.)", async () => {
    const admin = await createUser({ isAdmin: true });
    const evento = await createEvento(admin, {
      title: "Evento original",
      description: "Una descripción importante",
      conditions: "Condiciones puntuales",
      location: "Bar La Torre",
      eventDate: new Date("2026-09-01T20:00:00Z"),
      fee: 3500,
      maxParticipants: 24,
      transferDetails: "Alias: turnocero",
      status: "open",
    });

    // Partial cancel: only send status
    const res = await request(app)
      .put(`/api/eventos/${evento._id}`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .field("status", "cancelled");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
    expect(res.body.description).toBe("Una descripción importante");
    expect(res.body.conditions).toBe("Condiciones puntuales");
    expect(res.body.location).toBe("Bar La Torre");
    expect(res.body.eventDate).toBeTruthy();
    expect(res.body.fee).toBe(3500);
    expect(res.body.maxParticipants).toBe(24);
    expect(res.body.transferDetails).toBe("Alias: turnocero");

    // And the Cancelados admin filter now returns it
    const list = await request(app)
      .get("/api/eventos?status=cancelled")
      .set("Authorization", `Bearer ${tokenFor(admin)}`);
    expect(list.body.eventos.map((e) => e.title)).toContain("Evento original");
  });

  it("full form update can still clear individual fields with empty strings", async () => {
    const admin = await createUser({ isAdmin: true });
    const evento = await createEvento(admin, {
      title: "Con descripción",
      description: "va a desaparecer",
      location: "va a desaparecer",
      status: "open",
    });

    const res = await request(app)
      .put(`/api/eventos/${evento._id}`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .field("title", "Renombrado")
      .field("description", "")
      .field("location", "");

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Renombrado");
    expect(res.body.description).toBeFalsy();
    expect(res.body.location).toBeFalsy();
  });

  describe("imagen vieja vs upload nuevo (regresión: el destroy ocurría antes del upload)", () => {
    beforeEach(() => {
      cloudMock.__resetMocks();
    });

    it("sube primero el asset nuevo y recién después intenta destruir el viejo", async () => {
      const admin = await createUser({ isAdmin: true });
      const evento = await createEvento(admin);
      evento.image = {
        url: "https://mock.cloudinary/old.jpg",
        publicId: "turnocero/eventos/old-image-id",
      };
      await evento.save();

      const res = await request(app)
        .put(`/api/eventos/${evento._id}`)
        .set("Authorization", `Bearer ${tokenFor(admin)}`)
        .attach("image", Buffer.from([0xff, 0xd8, 0xff, 0xe0]), {
          filename: "new.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(200);
      expect(cloudMock.uploadToCloudinary).toHaveBeenCalledTimes(1);
      // El nuevo upload debe ocurrir antes del destroy del viejo. Si Cloudinary
      // fallara mid-upload, el evento conservaría su imagen anterior.
      const [uploadOrder] =
        cloudMock.uploadToCloudinary.mock.invocationCallOrder;
      const [destroyOrder] =
        cloudMock.cloudinary.uploader.destroy.mock.invocationCallOrder;
      expect(uploadOrder).toBeLessThan(destroyOrder);
      expect(cloudMock.cloudinary.uploader.destroy).toHaveBeenCalledWith(
        "turnocero/eventos/old-image-id",
      );
    });

    it("si el upload nuevo falla, el evento conserva su imagen vieja y no se borra del CDN", async () => {
      const admin = await createUser({ isAdmin: true });
      const evento = await createEvento(admin);
      evento.image = {
        url: "https://mock.cloudinary/old.jpg",
        publicId: "turnocero/eventos/keep-this-old-id",
      };
      await evento.save();

      cloudMock.uploadToCloudinary.mockRejectedValueOnce(
        new Error("cloudinary down"),
      );

      const res = await request(app)
        .put(`/api/eventos/${evento._id}`)
        .set("Authorization", `Bearer ${tokenFor(admin)}`)
        .attach("image", Buffer.from([0xff, 0xd8, 0xff, 0xe0]), {
          filename: "new.jpg",
          contentType: "image/jpeg",
        });

      // La ruta debería responder con un 500 genérico, pero lo que importa es
      // que el documento siga teniendo su imagen vieja y que no hayamos
      // disparado el destroy.
      expect(res.status).toBe(500);
      const refreshed = await Evento.findById(evento._id);
      expect(refreshed.image.publicId).toBe(
        "turnocero/eventos/keep-this-old-id",
      );
      expect(cloudMock.cloudinary.uploader.destroy).not.toHaveBeenCalled();
    });
  });
});

describe("GET /api/eventos/:id (public detail)", () => {
  it("exposes the author populated with avatar", async () => {
    const admin = await createUser({ isAdmin: true, username: "orga" });
    const evento = await createEvento(admin);

    const res = await request(app).get(`/api/eventos/${evento._id}`);
    expect(res.status).toBe(200);
    expect(res.body.author.username).toBe("orga");
    expect(res.body.author.avatar).toBeDefined();
  });

  it("returns confirmedRegistrations with { _id, username, displayName, avatar } per user (regression for the ghost-avatar bug)", async () => {
    const admin = await createUser({ isAdmin: true });
    const p1 = await createUser({ username: "player1" });
    const p2 = await createUser({
      username: "player2",
      displayName: "Player Two",
    });

    const evento = await createEvento(admin, {
      registrations: [
        { user: p1._id, status: "confirmed", submittedAt: new Date() },
        { user: p2._id, status: "confirmed", submittedAt: new Date() },
        { user: admin._id, status: "pending", submittedAt: new Date() },
      ],
    });

    const res = await request(app).get(`/api/eventos/${evento._id}`);
    expect(res.status).toBe(200);
    expect(res.body.confirmedRegistrations.length).toBe(2);
    const usernames = res.body.confirmedRegistrations
      .map((r) => r.user.username)
      .sort();
    expect(usernames).toEqual(["player1", "player2"]);

    // Every confirmed user MUST expose _id and avatar so client-side <Avatar>
    // works (without _id, getUserDisplay flags as deleted → ghost icon).
    for (const r of res.body.confirmedRegistrations) {
      expect(r.user._id).toBeTruthy();
      expect(r.user.avatar).toBeDefined();
    }
  });

  it("omits the bulky registrations array from the public payload", async () => {
    const admin = await createUser({ isAdmin: true });
    const evento = await createEvento(admin);
    const res = await request(app).get(`/api/eventos/${evento._id}`);
    expect(res.body.registrations).toBeUndefined();
  });

  it("returns the caller's own registration via userRegistration", async () => {
    const admin = await createUser({ isAdmin: true });
    const { user, token } = await createAuthedUser();
    const evento = await createEvento(admin, {
      registrations: [
        { user: user._id, status: "pending", submittedAt: new Date() },
      ],
    });

    const res = await request(app)
      .get(`/api/eventos/${evento._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.userRegistration).toMatchObject({ status: "pending" });
  });

  it("hides drafts from non-admins (404)", async () => {
    const admin = await createUser({ isAdmin: true });
    const evento = await createEvento(admin, { status: "draft" });
    const res = await request(app).get(`/api/eventos/${evento._id}`);
    expect(res.status).toBe(404);
  });

  it("hides cancelled events from non-admins (404)", async () => {
    const admin = await createUser({ isAdmin: true });
    const evento = await createEvento(admin, { status: "cancelled" });

    // Anonymous: 404
    const anon = await request(app).get(`/api/eventos/${evento._id}`);
    expect(anon.status).toBe(404);

    // Regular logged-in user: also 404
    const { token } = await createAuthedUser({ isAdmin: false });
    const user = await request(app)
      .get(`/api/eventos/${evento._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(user.status).toBe(404);

    // Admin: still sees it
    const adminRes = await request(app)
      .get(`/api/eventos/${evento._id}`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.status).toBe("cancelled");
  });
});

describe("POST /api/eventos (admin only)", () => {
  it("non-admin gets 403", async () => {
    const { token } = await createAuthedUser({ isAdmin: false });
    const res = await request(app)
      .post("/api/eventos")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "New");
    expect(res.status).toBe(403);
  });

  it("admin can create with no image", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .post("/api/eventos")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Sin imagen")
      .field("fee", 0)
      .field("location", "Buenos Aires")
      .field("eventDate", new Date(Date.now() + 7 * 86400000).toISOString());

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Sin imagen");
    expect(res.body.author.username).toBeDefined();
  });

  it("rejects creation without eventDate (400)", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .post("/api/eventos")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Sin fecha");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/fecha/i);
  });

  it("rejects creation with an invalid eventDate (400)", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .post("/api/eventos")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Fecha mala")
      .field("eventDate", "no-es-una-fecha");
    expect(res.status).toBe(400);
  });

  it("rejects creation without title (400)", async () => {
    const { token } = await createAuthedUser({ isAdmin: true });
    const res = await request(app)
      .post("/api/eventos")
      .set("Authorization", `Bearer ${token}`)
      .field("eventDate", new Date(Date.now() + 86400000).toISOString());
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/eventos/:id/inscripciones/:userId/confirmar", () => {
  it("flips a registration from pending to confirmed", async () => {
    const admin = await createUser({ isAdmin: true });
    const user = await createUser();
    const evento = await createEvento(admin, {
      registrations: [
        { user: user._id, status: "pending", submittedAt: new Date() },
      ],
    });

    const res = await request(app)
      .patch(`/api/eventos/${evento._id}/inscripciones/${user._id}/confirmar`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ adminNotes: "OK" });

    expect(res.status).toBe(200);
    const refreshed = await Evento.findById(evento._id);
    const reg = refreshed.registrations.find((r) => r.user.equals(user._id));
    expect(reg.status).toBe("confirmed");
    expect(reg.adminNotes).toBe("OK");
  });

  it("non-admin gets 403", async () => {
    const admin = await createUser({ isAdmin: true });
    const { user, token } = await createAuthedUser();
    const evento = await createEvento(admin, {
      registrations: [
        { user: user._id, status: "pending", submittedAt: new Date() },
      ],
    });

    const res = await request(app)
      .patch(`/api/eventos/${evento._id}/inscripciones/${user._id}/confirmar`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("rechaza la confirmación si ya se alcanzó el cupo máximo (regresión: overbooking)", async () => {
    const admin = await createUser({ isAdmin: true });
    const filler1 = await createUser({ username: "filler1" });
    const filler2 = await createUser({ username: "filler2" });
    const extra = await createUser({ username: "extra" });
    const evento = await createEvento(admin, {
      maxParticipants: 2,
      registrations: [
        { user: filler1._id, status: "confirmed", submittedAt: new Date() },
        { user: filler2._id, status: "confirmed", submittedAt: new Date() },
        { user: extra._id, status: "pending", submittedAt: new Date() },
      ],
    });

    const res = await request(app)
      .patch(`/api/eventos/${evento._id}/inscripciones/${extra._id}/confirmar`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cupo/i);

    // La registración debe seguir pending — no se promovió.
    const refreshed = await Evento.findById(evento._id);
    const reg = refreshed.registrations.find((r) => r.user.equals(extra._id));
    expect(reg.status).toBe("pending");
  });

  it("re-confirmar a un usuario ya confirmado es idempotente y no falla por cupo", async () => {
    const admin = await createUser({ isAdmin: true });
    const usr1 = await createUser({ username: "usr1" });
    const usr2 = await createUser({ username: "usr2" });
    const evento = await createEvento(admin, {
      maxParticipants: 2,
      registrations: [
        { user: usr1._id, status: "confirmed", submittedAt: new Date() },
        { user: usr2._id, status: "confirmed", submittedAt: new Date() },
      ],
    });

    const res = await request(app)
      .patch(`/api/eventos/${evento._id}/inscripciones/${usr1._id}/confirmar`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(200);
  });

  it("permite confirmar a un rechazado (no permanente) si todavía hay cupo", async () => {
    const admin = await createUser({ isAdmin: true });
    const usr1 = await createUser({ username: "usr1" });
    const usr2 = await createUser({ username: "usr2" });
    const evento = await createEvento(admin, {
      maxParticipants: 2,
      registrations: [
        { user: usr1._id, status: "confirmed", submittedAt: new Date() },
        { user: usr2._id, status: "rejected", submittedAt: new Date() },
      ],
    });

    const res = await request(app)
      .patch(`/api/eventos/${evento._id}/inscripciones/${usr2._id}/confirmar`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(200);
    const refreshed = await Evento.findById(evento._id);
    const reg = refreshed.registrations.find((r) => r.user.equals(usr2._id));
    expect(reg.status).toBe("confirmed");
  });
});

describe("Rechazo con permanent flag", () => {
  it("rechazo no-permanente permite re-inscribirse (recicla el registro)", async () => {
    const admin = await createUser({ isAdmin: true });
    const { user, token } = await createAuthedUser();
    const evento = await createEvento(admin, {
      fee: 0,
      registrations: [
        { user: user._id, status: "pending", submittedAt: new Date() },
      ],
    });

    // Admin rechaza sin permanent
    const reject = await request(app)
      .patch(`/api/eventos/${evento._id}/inscripciones/${user._id}/rechazar`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ permanent: false, adminNotes: "Comprobante ilegible" });
    expect(reject.status).toBe(200);
    expect(reject.body.permanentlyRejected).toBe(false);

    // User vuelve a inscribirse
    const retry = await request(app)
      .post(`/api/eventos/${evento._id}/inscribirse`)
      .set("Authorization", `Bearer ${token}`);
    expect(retry.status).toBe(201);
    expect(retry.body.status).toBe("pending");

    // Sólo hay UN registro (se recicló, no se duplicó)
    const refreshed = await Evento.findById(evento._id);
    const userRegs = refreshed.registrations.filter((r) =>
      r.user.equals(user._id),
    );
    expect(userRegs.length).toBe(1);
    expect(userRegs[0].status).toBe("pending");
    expect(userRegs[0].adminNotes).toBeFalsy(); // notas previas limpiadas
    expect(userRegs[0].reviewedAt).toBeFalsy();
  });

  it("rechazo no-permanente con evento pagado recicla el registro y limpia comprobante anterior", async () => {
    const admin = await createUser({ isAdmin: true });
    const { user, token } = await createAuthedUser();
    const evento = await createEvento(admin, {
      fee: 1500,
      registrations: [
        {
          user: user._id,
          status: "rejected",
          submittedAt: new Date(),
          reviewedAt: new Date(),
          adminNotes: "Comprobante ilegible",
          comprobante: {
            url: "https://res.cloudinary.com/x/image/upload/v1/turnocero/eventos/y/c.png",
            publicId: "turnocero/eventos/y/c",
            resourceType: "image",
            uploadedAt: new Date(),
          },
        },
      ],
    });

    // PNG mínimo (8 bytes header)
    const minimalPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const retry = await request(app)
      .post(`/api/eventos/${evento._id}/inscribirse`)
      .set("Authorization", `Bearer ${token}`)
      .attach("comprobante", minimalPng, {
        filename: "new.png",
        contentType: "image/png",
      });

    expect(retry.status).toBe(201);
    expect(retry.body.status).toBe("pending");
    expect(retry.body.comprobante).toBeTruthy();

    const refreshed = await Evento.findById(evento._id);
    const userRegs = refreshed.registrations.filter((r) =>
      r.user.equals(user._id),
    );
    expect(userRegs.length).toBe(1);
    expect(userRegs[0].status).toBe("pending");
    expect(userRegs[0].comprobante.publicId).not.toBe("turnocero/eventos/y/c"); // new file
  });

  it("rechazo permanente bloquea reintentos con 403", async () => {
    const admin = await createUser({ isAdmin: true });
    const { user, token } = await createAuthedUser();
    const evento = await createEvento(admin, {
      fee: 0,
      registrations: [
        { user: user._id, status: "pending", submittedAt: new Date() },
      ],
    });

    // Admin rechaza permanente
    const reject = await request(app)
      .patch(`/api/eventos/${evento._id}/inscripciones/${user._id}/rechazar`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ permanent: true });
    expect(reject.status).toBe(200);
    expect(reject.body.permanentlyRejected).toBe(true);

    // User intenta volver: 403
    const retry = await request(app)
      .post(`/api/eventos/${evento._id}/inscribirse`)
      .set("Authorization", `Bearer ${token}`);
    expect(retry.status).toBe(403);
    expect(retry.body.message).toMatch(/no podés volver/i);
  });

  it("GET /:id devuelve userRegistration.permanentlyRejected al usuario afectado", async () => {
    const admin = await createUser({ isAdmin: true });
    const { user, token } = await createAuthedUser();
    const evento = await createEvento(admin, {
      registrations: [
        {
          user: user._id,
          status: "rejected",
          submittedAt: new Date(),
          reviewedAt: new Date(),
          permanentlyRejected: true,
          adminNotes: "Comportamiento en eventos previos",
        },
      ],
    });

    const res = await request(app)
      .get(`/api/eventos/${evento._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userRegistration.status).toBe("rejected");
    expect(res.body.userRegistration.permanentlyRejected).toBe(true);
    expect(res.body.userRegistration.adminNotes).toBe(
      "Comportamiento en eventos previos",
    );
  });

  it("rejected (perm o no) no cuentan en registrationCount.confirmed/pending; el cliente los excluye del cupo", async () => {
    const admin = await createUser({ isAdmin: true });
    const p1 = await createUser({ username: "player_one" });
    const p2 = await createUser({ username: "player_two" });
    const p3 = await createUser({ username: "player_three" });

    const evento = await createEvento(admin, {
      registrations: [
        { user: p1._id, status: "confirmed", submittedAt: new Date() },
        { user: p2._id, status: "pending", submittedAt: new Date() },
        {
          user: p3._id,
          status: "rejected",
          permanentlyRejected: true,
          submittedAt: new Date(),
        },
      ],
    });

    const res = await request(app).get(`/api/eventos/${evento._id}`);
    expect(res.body.registrationCount).toEqual({
      total: 3,
      pending: 1,
      confirmed: 1,
    });
    // El cliente computa participants = pending + confirmed = 2 → el permanentemente
    // rechazado no entra. Validamos el contrato del endpoint.
  });

  it("revertir vuelve un registro confirmed a pending limpiando todo el contexto admin", async () => {
    const admin = await createUser({ isAdmin: true });
    const user = await createUser({ username: "someuser_revert" });
    const oldDate = new Date("2026-01-01T10:00:00");
    const evento = await createEvento(admin, {
      registrations: [
        {
          user: user._id,
          status: "confirmed",
          submittedAt: oldDate,
          reviewedAt: new Date(),
          reviewedBy: admin._id,
          adminNotes: "OK, pagó al toque",
        },
      ],
    });

    const res = await request(app)
      .patch(`/api/eventos/${evento._id}/inscripciones/${user._id}/revertir`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("pending");

    const refreshed = await Evento.findById(evento._id);
    const reg = refreshed.registrations.find((r) => r.user.equals(user._id));
    expect(reg.status).toBe("pending");
    expect(reg.submittedAt.getTime()).toBeGreaterThan(oldDate.getTime()); // reset al ahora
    expect(reg.reviewedAt).toBeFalsy();
    expect(reg.reviewedBy).toBeFalsy();
    expect(reg.adminNotes).toBeFalsy();
    expect(reg.permanentlyRejected).toBe(false);
  });

  it("revertir un permanentemente rechazado lo destrabra y vuelve a pending", async () => {
    const admin = await createUser({ isAdmin: true });
    const { user, token } = await createAuthedUser();
    const evento = await createEvento(admin, {
      fee: 0,
      registrations: [
        {
          user: user._id,
          status: "rejected",
          permanentlyRejected: true,
          adminNotes: "no",
          submittedAt: new Date(),
          reviewedAt: new Date(),
        },
      ],
    });

    // Admin revierte
    await request(app)
      .patch(`/api/eventos/${evento._id}/inscripciones/${user._id}/revertir`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`);

    const refreshed = await Evento.findById(evento._id);
    const reg = refreshed.registrations.find((r) => r.user.equals(user._id));
    expect(reg.status).toBe("pending");
    expect(reg.permanentlyRejected).toBe(false);

    // Ya no está bloqueado para inscribirse... aunque al ser pending,
    // no es que vaya a inscribirse de nuevo — su registro ya está activo.
    // Verificamos que el endpoint POST /inscribirse ahora reconoce "ya inscripto".
    const retry = await request(app)
      .post(`/api/eventos/${evento._id}/inscribirse`)
      .set("Authorization", `Bearer ${token}`);
    expect(retry.status).toBe(400);
    expect(retry.body.message).toMatch(/ya estás inscripto/i);
  });

  it("revertir requiere admin (403 para usuarios normales)", async () => {
    const admin = await createUser({ isAdmin: true });
    const target = await createUser({ username: "target_user" });
    const { token } = await createAuthedUser({ isAdmin: false });
    const evento = await createEvento(admin, {
      registrations: [
        { user: target._id, status: "rejected", submittedAt: new Date() },
      ],
    });

    const res = await request(app)
      .patch(`/api/eventos/${evento._id}/inscripciones/${target._id}/revertir`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("confirmar limpia el flag permanentlyRejected", async () => {
    const admin = await createUser({ isAdmin: true });
    const user = await createUser({ username: "someuser" });
    const evento = await createEvento(admin, {
      registrations: [
        {
          user: user._id,
          status: "rejected",
          permanentlyRejected: true,
          submittedAt: new Date(),
        },
      ],
    });

    await request(app)
      .patch(`/api/eventos/${evento._id}/inscripciones/${user._id}/confirmar`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`);

    const refreshed = await Evento.findById(evento._id);
    const reg = refreshed.registrations.find((r) => r.user.equals(user._id));
    expect(reg.status).toBe("confirmed");
    expect(reg.permanentlyRejected).toBe(false);
  });
});

describe("section gating", () => {
  it("blocks every route when eventos section is disabled (non-admin)", async () => {
    await updateSiteConfig({ eventos: { enabled: false } }, null, null);
    const res = await request(app).get("/api/eventos");
    expect(res.status).toBe(403);
  });
});

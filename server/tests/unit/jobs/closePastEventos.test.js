const { runOnce } = require("../../../jobs/closePastEventos");
const Evento = require("../../../models/Evento");
const { createUser } = require("../../helpers/auth");

async function createEventoAt(host, eventDate, status = "open") {
  return Evento.create({
    title: `Test ${Math.random()}`,
    eventDate,
    author: host._id,
    status,
    location: { texto: "X", lat: null, lng: null, displayName: "" },
  });
}

describe("closePastEventos.runOnce", () => {
  it("cierra eventos open con eventDate < now", async () => {
    const admin = await createUser({ isAdmin: true });
    const past = new Date("2020-01-01T12:00:00Z");
    const future = new Date(Date.now() + 7 * 86400000);

    const e1 = await createEventoAt(admin, past, "open");
    const e2 = await createEventoAt(admin, past, "open");
    const e3 = await createEventoAt(admin, future, "open");

    const result = await runOnce();
    expect(result.closed).toBe(2);

    const fresh = await Evento.find({ _id: { $in: [e1._id, e2._id, e3._id] } });
    const byStatus = fresh.reduce((acc, ev) => {
      acc[ev._id.toString()] = ev.status;
      return acc;
    }, {});
    expect(byStatus[e1._id.toString()]).toBe("closed");
    expect(byStatus[e2._id.toString()]).toBe("closed");
    expect(byStatus[e3._id.toString()]).toBe("open");
  });

  it("no toca eventos ya closed/cancelled/draft (solo open)", async () => {
    const admin = await createUser({ isAdmin: true });
    const past = new Date("2020-01-01T12:00:00Z");

    const closed = await createEventoAt(admin, past, "closed");
    const cancelled = await createEventoAt(admin, past, "cancelled");
    const draft = await createEventoAt(admin, past, "draft");

    const result = await runOnce();
    expect(result.closed).toBe(0);

    const fresh = await Evento.find({
      _id: { $in: [closed._id, cancelled._id, draft._id] },
    });
    expect(fresh.find((e) => e._id.equals(closed._id)).status).toBe("closed");
    expect(fresh.find((e) => e._id.equals(cancelled._id)).status).toBe(
      "cancelled",
    );
    expect(fresh.find((e) => e._id.equals(draft._id)).status).toBe("draft");
  });

  it("idempotente — segunda corrida no hace nada", async () => {
    const admin = await createUser({ isAdmin: true });
    const past = new Date("2020-01-01T12:00:00Z");
    await createEventoAt(admin, past, "open");

    const r1 = await runOnce();
    expect(r1.closed).toBe(1);

    const r2 = await runOnce();
    expect(r2.closed).toBe(0);
  });
});

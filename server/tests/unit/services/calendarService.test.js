const { getCalendarItems } = require("../../../services/calendarService");
const { createUser } = require("../../helpers/auth");
const { createTable, createEvento } = require("../../helpers/factories");
const {
  loadSiteConfig,
  updateSiteConfig,
} = require("../../../utils/siteConfig");

const daysFromNow = (n) => new Date(Date.now() + n * 86400000);
const from = daysFromNow(-1);
const to = daysFromNow(30);

describe("calendarService.getCalendarItems", () => {
  beforeEach(async () => {
    await loadSiteConfig();
    // Habilitamos mesas para los tests que las necesitan (default OFF).
    await updateSiteConfig({ mesas: { enabled: true } }, null, null);
  });

  it("normaliza cada item con tipo, url y host poblado", async () => {
    const host = await createUser({ displayName: "Anfitrión" });
    await createTable(host, { date: daysFromNow(3) });

    const { items } = await getCalendarItems({
      user: host,
      friendIds: [],
      from,
      to,
      scope: "todas",
    });

    expect(items).toHaveLength(1);
    const it = items[0];
    expect(it.tipo).toBe("mesa");
    expect(it.url).toBe(`/mesas/${it.id}`);
    expect(it.host?.displayName).toBe("Anfitrión");
    expect(it.date).toBeInstanceOf(Date);
  });

  it("ordena por fecha ascendente entre tipos distintos", async () => {
    const host = await createUser();
    await createTable(host, { date: daysFromNow(10) });
    await createEvento(host, { eventDate: daysFromNow(2), status: "open" });

    const { items } = await getCalendarItems({
      user: host,
      from,
      to,
      scope: "todas",
    });

    expect(items.map((i) => i.tipo)).toEqual(["evento", "mesa"]);
  });

  it("scope=mias sin usuario devuelve vacío", async () => {
    const host = await createUser();
    await createTable(host, { date: daysFromNow(3) });
    await createEvento(host, { eventDate: daysFromNow(4), status: "open" });

    const { items } = await getCalendarItems({
      user: null,
      from,
      to,
      scope: "mias",
    });

    expect(items).toHaveLength(0);
  });

  it("omite un tipo cuya sección está deshabilitada (no admin)", async () => {
    // Apagamos mesas; el evento (sección ON) debería seguir apareciendo.
    await updateSiteConfig({ mesas: { enabled: false } }, null, null);
    const host = await createUser();
    await createTable(host, { date: daysFromNow(3) });
    await createEvento(host, { eventDate: daysFromNow(4), status: "open" });

    const { items } = await getCalendarItems({
      user: host,
      from,
      to,
      scope: "todas",
      isAdmin: false,
    });

    expect(items.map((i) => i.tipo)).toEqual(["evento"]);
  });
});

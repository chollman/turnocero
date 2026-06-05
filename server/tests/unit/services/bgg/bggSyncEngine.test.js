const BggPlay = require("../../../../models/BggPlay");
const BggCollection = require("../../../../models/BggCollection");
const BggUserGame = require("../../../../models/BggUserGame");
const BggGame = require("../../../../models/BggGame");
const User = require("../../../../models/User");
const {
  PROBE_THROTTLE_MS,
  FULL_RECONCILE_INTERVAL_MS,
  SYNC_MAX_PAGES,
  RECONCILE_INTER_PAGE_MS,
  AUTO_REFRESH_STALE_MS,
  clearUserCache,
  reconcileFull,
  probe,
  stampProbeOutcome,
  stampReconcileResult,
  triggerBackgroundProbe,
  triggerBackgroundReconcile,
  decidePlaysSyncAction,
} = require("../../../../services/bgg/bggSyncEngine");
const bggCache = require("../../../../services/bgg/bggCache");
const bggSync = require("../../../../utils/bggSync");

// ── Helpers ──────────────────────────────────────────────────────────

// Construye XML de /plays con N plays. Permite override de date/gameId/playId
// para forzar paths específicos.
function buildPlaysXml(plays, { total } = {}) {
  const playsContent = plays
    .map(
      (p) => `
    <play id="${p.playId}" date="${p.date || "2026-01-01"}" quantity="1" length="60" incomplete="0" nowinstats="0" location="">
      <item name="${p.gameName || "Game"}" objecttype="thing" objectid="${p.gameId || "1"}"/>
      <players><player username="" name="Solo" startposition="" color="" score="" rating="0" new="0" win="1"/></players>
    </play>
  `,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><plays username="user" userid="1" total="${total ?? plays.length}" page="1">${playsContent}</plays>`;
}

function emptyPlaysXml(total = 0) {
  return `<?xml version="1.0" encoding="UTF-8"?><plays username="user" userid="1" total="${total}" page="1"></plays>`;
}

function invalidPlaysXml() {
  // Sin root <plays> — BGG devuelve esto cuando el user no existe.
  return `<?xml version="1.0" encoding="UTF-8"?><error/>`;
}

// Stub fetch para devolver respuestas en secuencia. Cada llamada consume la
// próxima de la lista; si se acaban, tira para que el test falle ruidosamente.
function stubFetchSequence(responses) {
  const queue = [...responses];
  return vi.fn(async () => {
    if (queue.length === 0) {
      throw new Error("stubFetchSequence: unexpected extra fetch call");
    }
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return { ok: true, status: 200, text: async () => next };
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  bggCache._resetForTests();
  bggSync._resetForTests();
});

// ── Tunables ─────────────────────────────────────────────────────────

describe("constantes", () => {
  it("expone los tunables esperados", () => {
    expect(PROBE_THROTTLE_MS).toBe(5 * 60 * 1000);
    expect(FULL_RECONCILE_INTERVAL_MS).toBe(30 * 24 * 60 * 60 * 1000);
    expect(SYNC_MAX_PAGES).toBe(200);
    expect(RECONCILE_INTER_PAGE_MS).toBe(500);
    expect(AUTO_REFRESH_STALE_MS).toBe(3 * 60 * 60 * 1000);
  });
});

// ── decidePlaysSyncAction ────────────────────────────────────────────

describe("decidePlaysSyncAction", () => {
  const NOW = 1_700_000_000_000;
  const ago = (ms) => new Date(NOW - ms);
  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  const recentFullSync = ago(DAY); // < 30d → reconcile NO vencido

  it("dueño + probe viejo (>3h) + reconcile reciente → probe sincrónico, sin background", () => {
    expect(
      decidePlaysSyncAction({
        lastProbedAt: ago(4 * HOUR),
        lastFullSyncAt: recentFullSync,
        now: NOW,
        viewerIsOwner: true,
      }),
    ).toEqual({ sync: true, background: null });
  });

  it("dueño + probe viejo (>3h) + reconcile vencido (>30d) → sincrónico + reconcile en background", () => {
    expect(
      decidePlaysSyncAction({
        lastProbedAt: ago(4 * HOUR),
        lastFullSyncAt: ago(40 * DAY),
        now: NOW,
        viewerIsOwner: true,
      }),
    ).toEqual({ sync: true, background: "reconcile" });
  });

  it("NO dueño + probe viejo (>3h) → nada (no gatilla refrescos ajenos)", () => {
    expect(
      decidePlaysSyncAction({
        lastProbedAt: ago(4 * HOUR),
        lastFullSyncAt: recentFullSync,
        now: NOW,
        viewerIsOwner: false,
      }),
    ).toEqual({ sync: false, background: null });
  });

  it("NO dueño + reconcile vencido (>30d) → igual nada", () => {
    expect(
      decidePlaysSyncAction({
        lastProbedAt: ago(4 * HOUR),
        lastFullSyncAt: ago(40 * DAY),
        now: NOW,
        viewerIsOwner: false,
      }),
    ).toEqual({ sync: false, background: null });
  });

  it("dueño + probe de 1h (<3h) → NADA (antes hacía background probe — éste es el fix)", () => {
    expect(
      decidePlaysSyncAction({
        lastProbedAt: ago(1 * HOUR),
        lastFullSyncAt: recentFullSync,
        now: NOW,
        viewerIsOwner: true,
      }),
    ).toEqual({ sync: false, background: null });
  });

  it("dueño + probe reciente (<5min) → nada, se sirve de Mongo", () => {
    expect(
      decidePlaysSyncAction({
        lastProbedAt: ago(1 * MIN),
        lastFullSyncAt: recentFullSync,
        now: NOW,
        viewerIsOwner: true,
      }),
    ).toEqual({ sync: false, background: null });
  });

  it("dueño + nunca probado → tratado como viejo: sincroniza + reconcile en background", () => {
    expect(
      decidePlaysSyncAction({
        lastProbedAt: null,
        lastFullSyncAt: null,
        now: NOW,
        viewerIsOwner: true,
      }),
    ).toEqual({ sync: true, background: "reconcile" });
  });

  it("NO dueño + nunca probado → nada", () => {
    expect(
      decidePlaysSyncAction({
        lastProbedAt: null,
        lastFullSyncAt: null,
        now: NOW,
        viewerIsOwner: false,
      }),
    ).toEqual({ sync: false, background: null });
  });
});

// ── clearUserCache ───────────────────────────────────────────────────

describe("clearUserCache", () => {
  it("borra BggPlay y BggCollection del user (case-insensitive)", async () => {
    await BggCollection.create({
      bggUsername: "claudio",
      games: [],
      lastFetchedAt: new Date(),
    });
    await BggPlay.create({
      bggUsername: "claudio",
      playId: "1",
      gameName: "Catan",
    });
    await BggPlay.create({
      bggUsername: "otro",
      playId: "1",
      gameName: "Catan",
    });

    // Pasamos casing distinto (User.bggUsername se guarda case-preserved)
    await clearUserCache("Claudio");

    expect(await BggCollection.countDocuments({ bggUsername: "claudio" })).toBe(
      0,
    );
    expect(await BggPlay.countDocuments({ bggUsername: "claudio" })).toBe(0);
    // No toca data de otros users.
    expect(await BggPlay.countDocuments({ bggUsername: "otro" })).toBe(1);
  });

  it("borra el cache materializado BggUserGame y marca userGamesBuiltAt null", async () => {
    await User.create({
      username: "claudio",
      displayName: "Claudio",
      email: "c@example.com",
      password: "HashedPw123",
      bggUsername: "claudio",
      emailVerified: true,
      bggSync: { userGamesBuiltAt: new Date() },
    });
    await BggUserGame.create({
      bggUsername: "claudio",
      gameId: "100",
      name: "Catan",
      searchName: "catan",
    });

    await clearUserCache("Claudio");

    expect(await BggUserGame.countDocuments({ bggUsername: "claudio" })).toBe(0);
    const u = await User.findOne({ bggUsername: "claudio" }).lean();
    expect(u.bggSync.userGamesBuiltAt).toBeNull();
  });

  it("invalida entries L1 (coleccion, og, partidas)", async () => {
    bggCache.setCached("coleccion:claudio", [{ id: 1 }]);
    bggCache.setCached("og:claudio", { foo: "bar" });
    bggCache.setCached("partidas:claudio:page1", [{ id: "1" }]);
    bggCache.setCached("partidas:otro:page1", [{ id: "1" }]);

    await clearUserCache("Claudio");

    expect(bggCache.getCached("coleccion:claudio")).toBeNull();
    expect(bggCache.getCached("og:claudio")).toBeNull();
    expect(bggCache.getCached("partidas:claudio:page1")).toBeNull();
    // No afecta otros users.
    expect(bggCache.getCached("partidas:otro:page1")).not.toBeNull();
  });
});

// ── reconcileFull ────────────────────────────────────────────────────

describe("reconcileFull", () => {
  it("inserta nuevas plays cuando local está vacío", async () => {
    const xml = buildPlaysXml([
      { playId: "1", date: "2026-01-15", gameId: "13", gameName: "Catan" },
      { playId: "2", date: "2026-01-10", gameId: "13", gameName: "Catan" },
    ]);
    vi.stubGlobal("fetch", stubFetchSequence([xml, emptyPlaysXml(2)]));

    const result = await reconcileFull("claudio", { full: true });
    expect(result.inserted).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.deleted).toBe(0);
    expect(result.total).toBe(2);
    expect(await BggPlay.countDocuments({ bggUsername: "claudio" })).toBe(2);
  });

  it("normaliza bggUsername a lowercase en los docs persistidos", async () => {
    const xml = buildPlaysXml([
      { playId: "1", date: "2026-01-15", gameId: "13", gameName: "Catan" },
    ]);
    vi.stubGlobal("fetch", stubFetchSequence([xml, emptyPlaysXml(1)]));

    await reconcileFull("Claudio", { full: true });
    // Vamos directo a la colección para esquivar la normalización lowercase
    // automática que aplica Mongoose en los filters.
    const docs = await BggPlay.collection.find({}).toArray();
    expect(docs).toHaveLength(1);
    expect(docs[0].bggUsername).toBe("claudio");
  });

  it("salta writes cuando el hash local matchea (idempotente)", async () => {
    // Primera corrida: persiste.
    const xml = buildPlaysXml([
      { playId: "1", date: "2026-01-15", gameId: "13", gameName: "Catan" },
    ]);
    vi.stubGlobal("fetch", stubFetchSequence([xml, emptyPlaysXml(1)]));
    await reconcileFull("claudio", { full: true });

    // Segunda corrida con el mismo XML — hash local matchea, no debe re-escribir.
    const fetchSpy = stubFetchSequence([xml, emptyPlaysXml(1)]);
    vi.stubGlobal("fetch", fetchSpy);
    const result = await reconcileFull("claudio", { full: true });
    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.deleted).toBe(0);
  });

  it("update cuando el hash difiere (in-place edit)", async () => {
    // Persistir con un comments null.
    await BggPlay.create({
      bggUsername: "claudio",
      playId: "1",
      date: "2026-01-15",
      gameId: "13",
      gameName: "Catan",
      hash: "stale-hash", // hash inválido → forzamos update
    });

    const xml = buildPlaysXml([
      { playId: "1", date: "2026-01-15", gameId: "13", gameName: "Catan" },
    ]);
    vi.stubGlobal("fetch", stubFetchSequence([xml, emptyPlaysXml(1)]));

    const result = await reconcileFull("claudio", { full: true });
    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(1);
    expect(result.deleted).toBe(0);
    const doc = await BggPlay.findOne({ bggUsername: "claudio", playId: "1" });
    expect(doc.hash).not.toBe("stale-hash");
  });

  it("full=true borra plays locales no vistas en el walk", async () => {
    await BggPlay.create({
      bggUsername: "claudio",
      playId: "999",
      date: "2026-01-01",
      gameId: "13",
      gameName: "Catan",
      hash: "x",
    });

    const xml = buildPlaysXml([
      { playId: "1", date: "2026-01-15", gameId: "13", gameName: "Catan" },
    ]);
    vi.stubGlobal("fetch", stubFetchSequence([xml, emptyPlaysXml(1)]));

    const result = await reconcileFull("claudio", { full: true });
    expect(result.deleted).toBe(1);
    expect(await BggPlay.countDocuments({ bggUsername: "claudio" })).toBe(1);
    expect(
      await BggPlay.findOne({ bggUsername: "claudio", playId: "999" }),
    ).toBeNull();
  });

  it("full=false solo borra plays con date estrictamente mayor a minSeenDate", async () => {
    // Pre-existe play vieja (2025) y otra muy nueva (2026-02-01) que no
    // aparece en el response.
    await BggPlay.create({
      bggUsername: "claudio",
      playId: "old",
      date: "2025-06-01",
      gameId: "13",
      gameName: "Catan",
      hash: "x",
    });
    await BggPlay.create({
      bggUsername: "claudio",
      playId: "ghost",
      date: "2026-02-01",
      gameId: "13",
      gameName: "Catan",
      hash: "x",
    });

    // BGG devuelve solo la del medio (2026-01-15). minSeenDate = 2026-01-15.
    // "old" tiene date < minSeenDate → NO se borra (conservador).
    // "ghost" tiene date > minSeenDate y no está en seen → se borra.
    const xml = buildPlaysXml([
      { playId: "1", date: "2026-01-15", gameId: "13", gameName: "Catan" },
    ]);
    vi.stubGlobal("fetch", stubFetchSequence([xml, emptyPlaysXml(3)]));

    const result = await reconcileFull("claudio", { full: false });
    expect(result.deleted).toBe(1);
    expect(
      await BggPlay.findOne({ bggUsername: "claudio", playId: "old" }),
    ).not.toBeNull();
    expect(
      await BggPlay.findOne({ bggUsername: "claudio", playId: "ghost" }),
    ).toBeNull();
  });

  it("full=false early-exit cuando una page entera matchea hash local", async () => {
    // Pre-persistimos BggGame para que resolveGamesBatch no haga fetch a
    // /thing — así solo contamos los fetches a /plays.
    await BggGame.create({ gameId: 13, name: "Catan", thumbnail: "t" });

    // Persistir play. Próximo reconcile(full=false) debe early-exit en page 1.
    const xml = buildPlaysXml([
      { playId: "1", date: "2026-01-15", gameId: "13", gameName: "Catan" },
    ]);
    vi.stubGlobal("fetch", stubFetchSequence([xml, emptyPlaysXml(1)]));
    await reconcileFull("claudio", { full: true });

    // Reconcile dirigido: el mismo XML otra vez. Solo debe hacer 1 fetch a
    // /plays (early exit porque page entera coincide). resolveGamesBatch hit
    // Mongo sin fetch porque ya cacheamos BggGame.
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => xml,
    }));
    vi.stubGlobal("fetch", fetchSpy);
    const result = await reconcileFull("claudio", { full: false });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.pages).toBe(1);
  });

  it("tira con err.status=404 si BGG no devuelve <plays> root (user inexistente)", async () => {
    vi.stubGlobal("fetch", stubFetchSequence([invalidPlaysXml()]));
    await expect(reconcileFull("nope", { full: true })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("propaga errores de fetchBgg", async () => {
    const err = new Error("BGG down");
    err.status = 502;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 502,
        text: async () => "",
      })),
    );
    await expect(
      reconcileFull("claudio", { full: true }),
    ).rejects.toMatchObject({
      status: 502,
    });
  });
});

// ── probe ────────────────────────────────────────────────────────────

describe("probe", () => {
  it("devuelve no_drift cuando counts y hashes coinciden", async () => {
    // Setup: persistir 1 play que matcheará el XML.
    const xml = buildPlaysXml([
      { playId: "1", date: "2026-01-15", gameId: "13", gameName: "Catan" },
    ]);
    vi.stubGlobal("fetch", stubFetchSequence([xml, emptyPlaysXml(1)]));
    await reconcileFull("claudio", { full: true });

    // Ahora probe debe ver same count + same hash → no_drift.
    vi.stubGlobal("fetch", stubFetchSequence([xml]));
    const result = await probe("claudio");
    expect(result.outcome).toBe("no_drift");
    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.total).toBe(1);
  });

  it("devuelve no_drift con plays vacías cuando local también está vacío", async () => {
    vi.stubGlobal("fetch", stubFetchSequence([emptyPlaysXml(0)]));
    const result = await probe("claudio");
    expect(result.outcome).toBe("no_drift");
    expect(result.total).toBe(0);
  });

  it("devuelve edits_only cuando count matchea pero un hash difiere", async () => {
    // Persistir con hash inválido para forzar dirty update.
    await BggPlay.create({
      bggUsername: "claudio",
      playId: "1",
      date: "2026-01-15",
      gameId: "13",
      gameName: "Catan",
      hash: "stale",
    });

    const xml = buildPlaysXml([
      { playId: "1", date: "2026-01-15", gameId: "13", gameName: "Catan" },
    ]);
    vi.stubGlobal("fetch", stubFetchSequence([xml]));
    const result = await probe("claudio");
    expect(result.outcome).toBe("edits_only");
    expect(result.updated).toBe(1);
    expect(result.inserted).toBe(0);
  });

  it("delega a reconcileFull cuando counts difieren (outcome=reconciled)", async () => {
    // Local: 0 plays. Remote: 2.
    const xml = buildPlaysXml([
      { playId: "1", date: "2026-01-15", gameId: "13", gameName: "Catan" },
      { playId: "2", date: "2026-01-10", gameId: "13", gameName: "Catan" },
    ]);
    vi.stubGlobal(
      "fetch",
      stubFetchSequence([
        xml, // probe → mismatched count
        xml, // reconcileFull page 1 — early-exit porque allMatch=false pero seen.size >= total
      ]),
    );

    const result = await probe("claudio");
    expect(result.outcome).toBe("reconciled");
    expect(result.inserted).toBe(2);
    expect(await BggPlay.countDocuments({ bggUsername: "claudio" })).toBe(2);
  });

  it("tira con err.status=404 si BGG no devuelve <plays> root", async () => {
    vi.stubGlobal("fetch", stubFetchSequence([invalidPlaysXml()]));
    await expect(probe("nope")).rejects.toMatchObject({ status: 404 });
  });
});

// ── stampProbeOutcome ────────────────────────────────────────────────

describe("stampProbeOutcome", () => {
  it("actualiza User.bggSync.lastProbedAt + lastProbeOutcome", async () => {
    const user = await User.create({
      username: "claudio",
      displayName: "Claudio",
      email: "c@example.com",
      password: "HashedPw123",
      bggUsername: "ClaudioH",
      emailVerified: true,
    });

    await stampProbeOutcome("ClaudioH", "no_drift");
    const updated = await User.findById(user._id);
    expect(updated.bggSync.lastProbeOutcome).toBe("no_drift");
    expect(updated.bggSync.lastProbedAt).toBeInstanceOf(Date);
  });

  it("matchea case-insensitive (User.bggUsername case-preserved vs caller lowercase)", async () => {
    const user = await User.create({
      username: "claudio",
      displayName: "Claudio",
      email: "c@example.com",
      password: "HashedPw123",
      bggUsername: "ClaudioH", // case-preserved
      emailVerified: true,
    });

    // Caller pasa lowercase (caso típico desde stampReconcileResult).
    await stampProbeOutcome("claudioh", "reconciled");
    const updated = await User.findById(user._id);
    expect(updated.bggSync.lastProbeOutcome).toBe("reconciled");
  });

  it("no propaga errores si el User no existe (best-effort)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // No tira aunque no haya match.
    await expect(stampProbeOutcome("ghost", "failed")).resolves.toBeUndefined();
    warnSpy.mockRestore();
  });
});

// ── stampReconcileResult ─────────────────────────────────────────────

describe("stampReconcileResult", () => {
  it("actualiza los 4 campos bggSync timing + lastFullSyncCount", async () => {
    const user = await User.create({
      username: "claudio",
      displayName: "Claudio",
      email: "c@example.com",
      password: "HashedPw123",
      bggUsername: "ClaudioH",
      emailVerified: true,
    });

    await stampReconcileResult("claudioh", { total: 42 });
    const updated = await User.findById(user._id);
    expect(updated.bggSync.lastFullSyncAt).toBeInstanceOf(Date);
    expect(updated.bggSync.lastFullSyncCount).toBe(42);
    expect(updated.bggSync.lastProbedAt).toBeInstanceOf(Date);
    expect(updated.bggSync.lastProbeOutcome).toBe("reconciled");
  });
});

// ── triggerBackgroundProbe ───────────────────────────────────────────

describe("triggerBackgroundProbe", () => {
  it("agarra slot y dispara probe en background", async () => {
    await User.create({
      username: "claudio",
      displayName: "Claudio",
      email: "c@example.com",
      password: "HashedPw123",
      bggUsername: "ClaudioH",
      emailVerified: true,
    });

    vi.stubGlobal("fetch", stubFetchSequence([emptyPlaysXml(0)]));

    triggerBackgroundProbe("ClaudioH");
    // Slot ocupado mientras corre.
    expect(bggSync._stats().activeProbes).toBe(1);

    // Esperar a que la cadena de promesas resuelva.
    await new Promise((r) => {
      setTimeout(r, 50);
    });
    expect(bggSync._stats().activeProbes).toBe(0);

    const u = await User.findOne({ bggUsername: "ClaudioH" });
    expect(u.bggSync.lastProbeOutcome).toBe("no_drift");
  });

  it("retorna sin disparar si no hay slot disponible (cap=MAX_PROBES)", async () => {
    // Saturar los slots manualmente.
    for (let i = 0; i < bggSync.MAX_PROBES; i++) {
      bggSync.tryAcquireProbeSlot();
    }

    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    triggerBackgroundProbe("claudio");
    await new Promise((r) => {
      setTimeout(r, 10);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("stampa outcome=failed cuando probe tira", async () => {
    await User.create({
      username: "claudio",
      displayName: "Claudio",
      email: "c@example.com",
      password: "HashedPw123",
      bggUsername: "ClaudioH",
      emailVerified: true,
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", stubFetchSequence([invalidPlaysXml()]));

    triggerBackgroundProbe("ClaudioH");
    await new Promise((r) => {
      setTimeout(r, 50);
    });

    const u = await User.findOne({ bggUsername: "ClaudioH" });
    expect(u.bggSync.lastProbeOutcome).toBe("failed");
    warnSpy.mockRestore();
  });
});

// ── triggerBackgroundReconcile ───────────────────────────────────────

describe("triggerBackgroundReconcile", () => {
  it("retorna true cuando agarra slot, false cuando está full", () => {
    // Saturar.
    const taken = [];
    for (let i = 0; i < bggSync.MAX_RECONCILES; i++) {
      taken.push(bggSync.tryAcquireReconcileSlot());
    }
    // Reset + simular slot disponible.
    bggSync._resetForTests();
    vi.stubGlobal("fetch", stubFetchSequence([emptyPlaysXml(0)]));
    expect(triggerBackgroundReconcile("claudio")).toBe(true);
  });

  it("retorna false sin disparar fetch si los slots están saturados", () => {
    for (let i = 0; i < bggSync.MAX_RECONCILES; i++) {
      bggSync.tryAcquireReconcileSlot();
    }
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(triggerBackgroundReconcile("claudio")).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("stampa User.bggSync.lastFullSyncAt al terminar exitosamente", async () => {
    await User.create({
      username: "claudio",
      displayName: "Claudio",
      email: "c@example.com",
      password: "HashedPw123",
      bggUsername: "ClaudioH",
      emailVerified: true,
    });

    // BGG vacío — reconcileFull termina al instante con total=0.
    vi.stubGlobal("fetch", stubFetchSequence([emptyPlaysXml(0)]));

    expect(triggerBackgroundReconcile("ClaudioH")).toBe(true);
    // El reconcile corre con background=true → sleep entre pages. Pero como
    // page 1 viene vacía, sale del loop antes del sleep. Esperamos a que la
    // cadena de stamping resuelva.
    await new Promise((r) => {
      setTimeout(r, 100);
    });

    const u = await User.findOne({ bggUsername: "ClaudioH" });
    expect(u.bggSync.lastFullSyncAt).toBeInstanceOf(Date);
    expect(u.bggSync.lastFullSyncCount).toBe(0);
    expect(bggSync._stats().activeReconciles).toBe(0);
  });
});

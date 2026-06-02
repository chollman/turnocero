const {
  buildWantGraph,
  solveUnbounded,
  solveBounded,
  solveAuto,
  decomposeCycles,
} = require("../../../utils/mathTradeMatching");

// item(id, ownerId, gameId, wants) — wants is [[gameId, rank], ...] or [gameId,...]
function item(id, ownerId, gameId, wants = []) {
  return {
    id,
    ownerId,
    gameId,
    wants: wants.map((w, idx) =>
      Array.isArray(w)
        ? { gameId: w[0], rank: w[1] }
        : { gameId: w, rank: idx + 1 },
    ),
  };
}

// Assert the math-trade invariants on a result: every traded item receives a
// game on its own want list, gives to exactly one other item, no owner trades
// with itself, and traded count is even-balanced per cycle.
function assertValid(result, items) {
  const byId = new Map(items.map((it) => [String(it.id), it]));
  for (const p of result.perItem) {
    if (!p.traded) {
      expect(p.receivesFromItem).toBeNull();
      expect(p.givesToItem).toBeNull();
      continue;
    }
    const owner = byId.get(String(p.itemId));
    const wantedGames = owner.wants.map((w) => w.gameId);
    expect(wantedGames).toContain(p.receivesGameId);
    expect(p.receivesFromItem).not.toBeNull();
    expect(p.givesToItem).not.toBeNull();
    // never receive your own item
    expect(String(p.receivesFromItem)).not.toBe(String(p.itemId));
    // the item you receive belongs to a different owner
    const received = byId.get(String(p.receivesFromItem));
    expect(String(received.ownerId)).not.toBe(String(owner.ownerId));
  }
  // Each cycle's items must be a vertex-disjoint set across all cycles.
  const seen = new Set();
  for (const c of result.cycles) {
    expect(c.length).toBeGreaterThanOrEqual(2);
    for (const ci of c.items) {
      expect(seen.has(String(ci.itemId))).toBe(false);
      seen.add(String(ci.itemId));
    }
  }
  expect(seen.size).toBe(result.summary.itemsTraded);
}

describe("buildWantGraph", () => {
  it("crea aristas hacia ítems que ofrecen un juego querido", () => {
    const items = [
      item("A", "u1", "G1", [["G2", 1]]),
      item("B", "u2", "G2", [["G1", 1]]),
    ];
    const { adj } = buildWantGraph(items);
    expect(adj[0]).toEqual([{ to: 1, rank: 1 }]);
    expect(adj[1]).toEqual([{ to: 0, rank: 1 }]);
  });

  it("excluye aristas hacia ítems del mismo dueño (no se intercambia con uno mismo)", () => {
    const items = [
      item("A", "u1", "G1", [["G2", 1]]),
      item("B", "u1", "G2", [["G1", 1]]), // mismo dueño u1
    ];
    const { adj } = buildWantGraph(items);
    expect(adj[0]).toEqual([]);
    expect(adj[1]).toEqual([]);
  });

  it("toma el mejor rank cuando varios wants apuntan al mismo ítem", () => {
    const items = [
      item("A", "u1", "G1", [["G2", 3]]),
      // B ofrece G2; A lo quiere con rank 3
      item("B", "u2", "G2", []),
    ];
    const { adj } = buildWantGraph(items);
    expect(adj[0]).toEqual([{ to: 1, rank: 3 }]);
  });
});

describe("solveUnbounded", () => {
  it("arma un 2-ciclo recíproco simple", () => {
    const items = [
      item("A", "u1", "G1", [["G2", 1]]),
      item("B", "u2", "G2", [["G1", 1]]),
    ];
    const res = solveUnbounded(items);
    expect(res.summary.itemsTraded).toBe(2);
    expect(res.summary.cyclesCount).toBe(1);
    expect(res.summary.longestCycle).toBe(2);
    const a = res.perItem.find((p) => p.itemId === "A");
    expect(a.receivesFromItem).toBe("B");
    expect(a.receivesGameId).toBe("G2");
    expect(a.givesToItem).toBe("B");
    assertValid(res, items);
  });

  it("arma un 3-ciclo (A→B→C→A)", () => {
    const items = [
      item("A", "u1", "G1", [["G2", 1]]),
      item("B", "u2", "G2", [["G3", 1]]),
      item("C", "u3", "G3", [["G1", 1]]),
    ];
    const res = solveUnbounded(items);
    expect(res.summary.itemsTraded).toBe(3);
    expect(res.summary.cyclesCount).toBe(1);
    expect(res.summary.longestCycle).toBe(3);
    const a = res.perItem.find((p) => p.itemId === "A");
    expect(a.receivesGameId).toBe("G2");
    assertValid(res, items);
  });

  it("no intercambia cuando nadie ofrece lo querido", () => {
    const items = [
      item("A", "u1", "G1", [["G99", 1]]), // nadie ofrece G99
      item("B", "u2", "G2", [["G1", 1]]),
    ];
    const res = solveUnbounded(items);
    expect(res.summary.itemsTraded).toBe(0);
    expect(res.cycles).toEqual([]);
    res.perItem.forEach((p) => expect(p.traded).toBe(false));
  });

  it("un solo dueño que ofrece y quiere su propio juego NO auto-tradea", () => {
    const items = [
      item("A", "u1", "G1", [["G2", 1]]),
      item("B", "u1", "G2", [["G1", 1]]), // mismo dueño
    ];
    const res = solveUnbounded(items);
    expect(res.summary.itemsTraded).toBe(0);
  });

  it("respeta la preferencia (rank) al desempatar entre dos matches posibles", () => {
    const items = [
      // A puede recibir G2 (de B, rank 1) o G3 (de C, rank 2): prefiere G2
      item("A", "u1", "GA", [
        ["G2", 1],
        ["G3", 2],
      ]),
      item("B", "u2", "G2", [["GA", 1]]),
      item("C", "u3", "G3", [["GA", 1]]),
    ];
    const res = solveUnbounded(items);
    // Solo uno de B/C puede recibir el único GA → ambos intercambian 2 ítems;
    // el desempate por rank elige el 2-ciclo A↔B.
    expect(res.summary.itemsTraded).toBe(2);
    const a = res.perItem.find((p) => p.itemId === "A");
    expect(a.receivesGameId).toBe("G2");
    const c = res.perItem.find((p) => p.itemId === "C");
    expect(c.traded).toBe(false);
    assertValid(res, items);
  });

  it("resuelve dos 2-ciclos independientes a la vez", () => {
    const items = [
      item("A", "u1", "G1", [["G2", 1]]),
      item("B", "u2", "G2", [["G1", 1]]),
      item("C", "u3", "G3", [["G4", 1]]),
      item("D", "u4", "G4", [["G3", 1]]),
    ];
    const res = solveUnbounded(items);
    expect(res.summary.itemsTraded).toBe(4);
    expect(res.summary.cyclesCount).toBe(2);
    assertValid(res, items);
  });
});

describe("solveBounded", () => {
  it("con K=2 NO arma un 3-ciclo (mientras que unbounded sí)", () => {
    const items = [
      item("A", "u1", "G1", [["G2", 1]]),
      item("B", "u2", "G2", [["G3", 1]]),
      item("C", "u3", "G3", [["G1", 1]]),
    ];
    expect(solveUnbounded(items).summary.itemsTraded).toBe(3);

    const bounded = solveBounded(items, 2);
    expect(bounded.summary.itemsTraded).toBe(0);
    expect(bounded.summary.longestCycle).toBe(0);
    expect(bounded.summary.approximate).toBe(false);
  });

  it("con K=3 sí arma el 3-ciclo", () => {
    const items = [
      item("A", "u1", "G1", [["G2", 1]]),
      item("B", "u2", "G2", [["G3", 1]]),
      item("C", "u3", "G3", [["G1", 1]]),
    ];
    const res = solveBounded(items, 3);
    expect(res.summary.itemsTraded).toBe(3);
    expect(res.summary.longestCycle).toBe(3);
    assertValid(res, items);
  });

  it("prefiere dos 2-ciclos antes que dejar todo sin intercambiar (K=2)", () => {
    const items = [
      item("A", "u1", "G1", [["G2", 1]]),
      item("B", "u2", "G2", [["G1", 1]]),
      item("C", "u3", "G3", [["G4", 1]]),
      item("D", "u4", "G4", [["G3", 1]]),
      // un 3-ciclo aparte que K=2 no puede tomar
      item("E", "u5", "G5", [["G6", 1]]),
      item("F", "u6", "G6", [["G7", 1]]),
      item("H", "u7", "G7", [["G5", 1]]),
    ];
    const res = solveBounded(items, 2);
    expect(res.summary.itemsTraded).toBe(4); // los dos 2-ciclos, no el 3-ciclo
    expect(res.summary.longestCycle).toBe(2);
    assertValid(res, items);
  });

  it("cae a heurístico aproximado cuando la enumeración supera el tope", () => {
    // Grafo casi completo: 12 dueños, cada uno quiere todos los demás juegos,
    // con K alto → explosión combinatoria de ciclos → truncado/aproximado.
    const n = 12;
    const games = Array.from({ length: n }, (_, i) => `G${i}`);
    const items = games.map((g, i) =>
      item(
        `I${i}`,
        `u${i}`,
        g,
        games.filter((_, j) => j !== i).map((gj, idx) => [gj, idx + 1]),
      ),
    );
    const res = solveBounded(items, 8);
    expect(res.summary.approximate).toBe(true);
    // El resultado sigue siendo un conjunto de ciclos válido y disjunto.
    assertValid(res, items);
    expect(res.summary.longestCycle).toBeLessThanOrEqual(8);
  });
});

// Construye un grafo "casi completo": N dueños, cada uno ofrece un juego único
// y quiere TODOS los demás. Sirve para estresar el packing acotado a escala.
function completeItems(n) {
  return Array.from({ length: n }, (_, i) =>
    item(
      `I${i}`,
      `u${i}`,
      `G${i}`,
      Array.from({ length: n }, (_, j) => j)
        .filter((j) => j !== i)
        .map((j, idx) => [`G${j}`, idx + 1]),
    ),
  );
}

describe("solveBounded — cobertura a escala (peeling)", () => {
  it("no colapsa en grafos grandes y densos: cubre casi todo", () => {
    // 30 dueños, grafo completo, K=3 → la enumeración se trunca y entra el
    // heurístico de peeling. Antes esto daba ~5 intercambios; ahora debe
    // cubrir casi todos (regresión del bug XL9).
    const items = completeItems(30);
    const res = solveBounded(items, 3);
    expect(res.summary.itemsTraded).toBeGreaterThanOrEqual(27);
    expect(res.summary.longestCycle).toBeLessThanOrEqual(3);
    assertValid(res, items);
  });
});

describe("solveAuto", () => {
  it("elige la cadena MÁS CORTA que alcanza el máximo (2-ciclos cubren todo)", () => {
    // Dos pares recíprocos: el máximo (4) se logra con cadenas de 2.
    const items = [
      item("A", "u1", "G1", [["G2", 1]]),
      item("B", "u2", "G2", [["G1", 1]]),
      item("C", "u3", "G3", [["G4", 1]]),
      item("D", "u4", "G4", [["G3", 1]]),
    ];
    const res = solveAuto(items);
    expect(res.summary.itemsTraded).toBe(4);
    expect(res.summary.chosenChainLength).toBe(2);
    expect(Array.isArray(res.curve)).toBe(true);
    assertValid(res, items);
  });

  it("sube a K=3 cuando 2 no alcanza (solo hay 3-ciclos)", () => {
    const items = [
      item("A", "u1", "G1", [["G2", 1]]),
      item("B", "u2", "G2", [["G3", 1]]),
      item("C", "u3", "G3", [["G1", 1]]),
      item("D", "u4", "G4", [["G5", 1]]),
      item("E", "u5", "G5", [["G6", 1]]),
      item("F", "u6", "G6", [["G4", 1]]),
    ];
    const res = solveAuto(items);
    expect(res.summary.itemsTraded).toBe(6);
    expect(res.summary.chosenChainLength).toBe(3);
    assertValid(res, items);
  });

  it("en un grafo denso prefiere cadenas cortas (chosenChainLength chico)", () => {
    const items = completeItems(12);
    const res = solveAuto(items);
    // El máximo (12) se alcanza ya con cadenas de 2 → debe elegir 2.
    expect(res.summary.itemsTraded).toBeGreaterThanOrEqual(11);
    expect(res.summary.chosenChainLength).toBe(2);
    assertValid(res, items);
  });

  it("sin matches devuelve 0 y chosenChainLength null", () => {
    const items = [
      item("A", "u1", "G1", [["G99", 1]]),
      item("B", "u2", "G2", [["G98", 1]]),
    ];
    const res = solveAuto(items);
    expect(res.summary.itemsTraded).toBe(0);
    expect(res.summary.chosenChainLength).toBeNull();
  });
});

describe("decomposeCycles", () => {
  it("marca puntos fijos como no intercambiados", () => {
    const items = [
      item("A", "u1", "G1"),
      item("B", "u2", "G2"),
      item("C", "u3", "G3"),
    ];
    const res = decomposeCycles([0, 1, 2], items, false);
    expect(res.summary.itemsTraded).toBe(0);
    expect(res.cycles).toEqual([]);
  });

  it("propaga el flag approximate", () => {
    const items = [item("A", "u1", "G1"), item("B", "u2", "G2")];
    const res = decomposeCycles([1, 0], items, true);
    expect(res.summary.approximate).toBe(true);
    expect(res.summary.itemsTraded).toBe(2);
  });
});

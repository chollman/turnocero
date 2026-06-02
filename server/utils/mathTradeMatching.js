/**
 * Math Trade matching engines.
 *
 * A math trade lets users offer items (board games) and, per offered item,
 * declare a ranked want list of games they'd accept in return. The matcher
 * computes a set of trades that form **cycles**: in a cycle i1 → i2 → … → iL → i1
 * the owner of i1 receives i2 (a game on i1's want list), the owner of i2
 * receives i3, …, and the owner of iL receives i1. Every traded item's owner
 * both gives one item and receives one wanted item — that invariant is the
 * whole point of a math trade.
 *
 * ─ Input shape (plain, DB-agnostic) ────────────────────────────────────────
 *   items = [{ id, ownerId, gameId, wants: [{ gameId, rank }] }]
 *
 * Want lists reference game *titles* (gameId), so "I want game G" expands to an
 * edge toward every *other user's* item offering G.
 *
 * ─ Three engines (the service picks one by `mode`) ─────────────────────────
 *   solveUnbounded(items)     'max'    — maximize items traded, chains of any
 *                                        length. Exact (Hungarian assignment).
 *   solveBounded(items, K)    'bounded'— max items traded with no cycle longer
 *                                        than K. NP-hard: exact branch-and-bound
 *                                        for small instances, else a strong
 *                                        multi-start greedy "peeling" heuristic
 *                                        (flagged `approximate`).
 *   solveAuto(items)          'auto'   — find the SHORTEST chain cap that still
 *                                        captures ~all the exchanges of the
 *                                        unbounded maximum (robustness for ~free).
 *
 * All engines return the same shape (see `decomposeCycles`). Pure module
 * (no Mongo/Express); the service builds the input and persists the output.
 */

// ── Tuning constants (exported for tests) ──────────────────────────────────

const NOT_TRADED_PENALTY = 1e6; // self-assignment cost (must dominate rank)
const DISALLOWED = 1e9; // impossible assignment
const ALG_INF = 1e15; // Hungarian sentinel "infinity"

const MAX_CYCLES = 20000; // global cap on enumerated cycles
const PER_NODE_CYCLE_CAP = 1500; // fairness: cap cycles per start node so the
//                                  enumeration isn't monopolized by low indices
const BNB_CYCLE_LIMIT = 4000; // above this many cycles, skip exact B&B
const BNB_STEP_BUDGET = 2_000_000; // branch-and-bound recursion-step budget
const PEEL_ATTEMPTS = 5; // seeded multi-start passes for the peeling heuristic
const FIND_CYCLE_BUDGET = 8000; // node-visit budget per cycle search (peeling)

const AUTO_MAX_K = 10; // auto mode: largest chain length to probe
const AUTO_TOLERANCE = 0.05; // auto mode: accept K reaching ≥(1-tol) of the max

// ── Graph construction ─────────────────────────────────────────────────────

/**
 * Build the directed "want graph". Edge i → j (rank r) means the owner of item
 * i wants the game item j offers (preference rank r). Edges to one's own items
 * are excluded. Duplicate edges keep the best (lowest) rank.
 *
 * @returns {{ adj: Array<Array<{to:number, rank:number}>> }}
 */
function buildWantGraph(items) {
  const byGame = new Map();
  items.forEach((it, idx) => {
    const list = byGame.get(it.gameId);
    if (list) list.push(idx);
    else byGame.set(it.gameId, [idx]);
  });

  const adj = items.map(() => []);
  items.forEach((it, i) => {
    const best = new Map();
    for (const want of it.wants || []) {
      const offerers = byGame.get(want.gameId);
      if (!offerers) continue;
      for (const j of offerers) {
        if (j === i) continue;
        if (
          it.ownerId != null &&
          items[j].ownerId != null &&
          String(items[j].ownerId) === String(it.ownerId)
        ) {
          continue;
        }
        const rank = Number(want.rank) || 1;
        const prev = best.get(j);
        if (prev === undefined || rank < prev) best.set(j, rank);
      }
    }
    for (const [j, rank] of best) adj[i].push({ to: j, rank });
  });

  return { adj };
}

// ── Engine 1: unbounded (exact, polynomial) ────────────────────────────────

/**
 * Maximize the number of items traded with chains of any length. Min-cost
 * perfect assignment (Hungarian): each item receives either itself (penalty)
 * or an item offering a wanted game (cost = rank). The permutation guarantees
 * the give/receive invariant.
 */
function solveUnbounded(items) {
  const n = items.length;
  if (n < 2) return decomposeCycles(identity(n), items, false);

  const { adj } = buildWantGraph(items);

  const cost = Array.from({ length: n }, () => new Array(n).fill(DISALLOWED));
  for (let i = 0; i < n; i++) {
    cost[i][i] = NOT_TRADED_PENALTY;
    for (const { to, rank } of adj[i]) cost[i][to] = rank;
  }

  const receive = hungarian(cost);
  for (let i = 0; i < n; i++) {
    if (receive[i] !== i && cost[i][receive[i]] >= DISALLOWED) receive[i] = i;
  }
  return decomposeCycles(receive, items, false);
}

/**
 * Hungarian algorithm (Kuhn–Munkres) for the square min-cost assignment
 * problem. O(n³). Returns `assignment[i] = column matched to row i`.
 */
function hungarian(a) {
  const n = a.length;
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0);
  const way = new Array(n + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(ALG_INF);
    const used = new Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = ALG_INF;
      let j1 = -1;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = a[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }

  const assignment = new Array(n).fill(0);
  for (let j = 1; j <= n; j++) {
    if (p[j] > 0) assignment[p[j] - 1] = j - 1;
  }
  return assignment;
}

// ── Engine 2: bounded (NP-hard; exact under a cap, else strong heuristic) ───

/**
 * Maximize items traded with no cycle longer than `maxChainLength`.
 *
 * Pipeline (see `boundedPacking`): fair cycle enumeration → exact B&B for small
 * instances, else multi-start greedy peeling; then a final peel pass squeezes
 * any cycles the search missed among still-free nodes. That final pass is what
 * keeps coverage high on large dense graphs (the naive enumerate-then-greedy
 * collapsed to almost nothing there).
 */
function solveBounded(items, maxChainLength) {
  const n = items.length;
  const K = Math.max(2, Math.floor(maxChainLength || 2));
  if (n < 2) {
    const r = decomposeCycles(identity(n), items, false);
    r.summary.chosenChainLength = K;
    return r;
  }

  const { adj } = buildWantGraph(items);
  const sel = boundedPacking(adj, n, K);

  const result = decomposeCycles(
    cyclesToReceive(sel.cycles, n),
    items,
    sel.approximate,
  );
  result.summary.chosenChainLength = K;
  return result;
}

/**
 * Compute a high-coverage vertex-disjoint set of cycles of length ≤ K.
 * @returns {{ cycles: number[][], approximate: boolean }}
 */
function boundedPacking(adj, n, K) {
  const { cycles, truncated } = enumerateCycles(adj, K);

  let selection;
  let approximate;
  if (!truncated && cycles.length <= BNB_CYCLE_LIMIT) {
    const res = branchAndBound(cycles, n);
    selection = res.selection.map((c) => c.nodes);
    approximate = res.truncated;
  } else {
    selection = multiStartPeeling(adj, n, K).map((c) => c.nodes);
    approximate = true;
  }

  // Final peel: cover free nodes the search missed. No-op when the search was
  // exhaustive/optimal; if it adds anything, optimality isn't guaranteed.
  const used = new Array(n).fill(false);
  for (const nodes of selection) for (const x of nodes) used[x] = true;
  const extra = peelingPack(adj, n, K, defaultOrder(n), used);
  if (extra.length) {
    approximate = true;
    for (const c of extra) selection.push(c.nodes);
  }
  return { cycles: selection, approximate };
}

function cyclesToReceive(cycles, n) {
  const receive = identity(n);
  for (const nodes of cycles) {
    for (let k = 0; k < nodes.length; k++) {
      receive[nodes[k]] = nodes[(k + 1) % nodes.length];
    }
  }
  return receive;
}

/**
 * Enumerate simple directed cycles of length 2..K, each in its canonical
 * rotation (smallest index first). Per-node cap keeps enumeration fair across
 * start nodes; global cap sets `truncated`.
 */
function enumerateCycles(adj, K) {
  const n = adj.length;
  const cycles = [];
  let truncated = false;
  const onPath = new Array(n).fill(false);
  let perNode = 0;

  function dfs(start, u, path, rankSum) {
    if (truncated || perNode >= PER_NODE_CYCLE_CAP) return;
    for (const { to: w, rank } of adj[u]) {
      if (w === start) {
        if (path.length >= 2) {
          if (cycles.length >= MAX_CYCLES) {
            truncated = true;
            return;
          }
          cycles.push({
            nodes: path.slice(),
            length: path.length,
            rankSum: rankSum + rank,
          });
          if (++perNode >= PER_NODE_CYCLE_CAP) return;
        }
        continue;
      }
      if (w < start || onPath[w]) continue;
      if (path.length >= K) continue;
      onPath[w] = true;
      path.push(w);
      dfs(start, w, path, rankSum + rank);
      path.pop();
      onPath[w] = false;
      if (truncated || perNode >= PER_NODE_CYCLE_CAP) return;
    }
  }

  for (let s = 0; s < n && !truncated; s++) {
    perNode = 0;
    onPath[s] = true;
    dfs(s, s, [s], 0);
    onPath[s] = false;
  }

  return { cycles, truncated };
}

/**
 * Exact max-weight vertex-disjoint cycle packing via branch-and-bound. Weight =
 * items traded; tie-break minimizes rankSum. `truncated` if the step budget
 * ran out (best-so-far still valid).
 */
function branchAndBound(cycles, n) {
  const order = [...cycles].sort(cycleComparator);
  const used = new Array(n).fill(false);

  let best = { traded: -1, rankSum: Infinity, selection: [] };
  const current = [];
  let curTraded = 0;
  let curRank = 0;
  let steps = 0;
  let truncated = false;

  function remainingBound(idx) {
    let b = 0;
    for (let k = idx; k < order.length; k++) b += order[k].length;
    return b;
  }

  function recurse(idx) {
    if (truncated) return;
    if (++steps > BNB_STEP_BUDGET) {
      truncated = true;
      return;
    }
    if (
      curTraded > best.traded ||
      (curTraded === best.traded && curRank < best.rankSum)
    ) {
      best = {
        traded: curTraded,
        rankSum: curRank,
        selection: current.slice(),
      };
    }
    if (idx >= order.length) return;
    if (curTraded + remainingBound(idx) < best.traded) return;

    const c = order[idx];
    if (!c.nodes.some((x) => used[x])) {
      for (const x of c.nodes) used[x] = true;
      current.push(c);
      curTraded += c.length;
      curRank += c.rankSum;
      recurse(idx + 1);
      curRank -= c.rankSum;
      curTraded -= c.length;
      current.pop();
      for (const x of c.nodes) used[x] = false;
    }
    recurse(idx + 1);
  }

  recurse(0);
  return { selection: best.selection, truncated };
}

function cycleComparator(a, b) {
  if (b.length !== a.length) return b.length - a.length;
  return a.rankSum - b.rankSum;
}

// ── Bounded heuristic: greedy "peeling" ─────────────────────────────────────

function defaultOrder(n) {
  return Array.from({ length: n }, (_, i) => i);
}

/**
 * Find ONE simple cycle of length ≤ K starting/ending at `start`, using only
 * free nodes (not in `used`). Returns the node list or null. Bounded by a
 * visit budget so dense graphs can't blow up.
 */
function findCycleFrom(adj, start, K, used) {
  const path = [start];
  const onPath = new Set([start]);
  let found = null;
  let budget = FIND_CYCLE_BUDGET;
  function dfs(u) {
    if (found || budget <= 0) return;
    budget--;
    for (const { to: w } of adj[u]) {
      if (found) return;
      if (w === start) {
        if (path.length >= 2) {
          found = path.slice();
          return;
        }
        continue;
      }
      if (used[w] || onPath.has(w)) continue;
      if (path.length >= K) continue;
      path.push(w);
      onPath.add(w);
      dfs(w);
      if (found) return;
      path.pop();
      onPath.delete(w);
    }
  }
  dfs(start);
  return found;
}

/**
 * Greedy peeling: walk nodes in `order`, carve a ≤K cycle out of each free
 * node, mark used, repeat until a full pass adds nothing. `usedInit` seeds
 * already-taken nodes (cloned, not mutated).
 */
function peelingPack(adj, n, K, order, usedInit) {
  const used = usedInit ? usedInit.slice() : new Array(n).fill(false);
  const selection = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of order) {
      if (used[s]) continue;
      const cyc = findCycleFrom(adj, s, K, used);
      if (cyc) {
        for (const x of cyc) used[x] = true;
        selection.push({ nodes: cyc, length: cyc.length });
        changed = true;
      }
    }
  }
  return selection;
}

/**
 * Run peeling from several node orderings (degree-based + seeded shuffles) and
 * keep the packing covering the most items.
 */
function multiStartPeeling(adj, n, K) {
  const deg = adj.map((a) => a.length);
  const base = defaultOrder(n);
  const orders = [
    base,
    [...base].sort((a, b) => deg[b] - deg[a]),
    [...base].sort((a, b) => deg[a] - deg[b]),
  ];
  for (let s = 1; s <= PEEL_ATTEMPTS; s++) {
    orders.push(shuffle(base.slice(), seededRng(s * 2654435761)));
  }
  let best = [];
  let bestCov = -1;
  for (const order of orders) {
    const sel = peelingPack(adj, n, K, order);
    const cov = sel.reduce((a, c) => a + c.length, 0);
    if (cov > bestCov) {
      bestCov = cov;
      best = sel;
    }
  }
  return best;
}

// Deterministic PRNG + Fisher–Yates (no Math.random → reproducible / test-stable).
function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Engine 3: auto (shortest chain that keeps ~all the exchanges) ───────────

/**
 * Compute the absolute maximum exchanges (unbounded) as the ceiling, then probe
 * increasing chain caps K=2,3,… and pick the SMALLEST K whose exchanges reach
 * at least (1 - tolerance) of that ceiling. Favors short, robust chains while
 * giving up only an insignificant number of trades. If no K within `maxK` gets
 * there, falls back to the unbounded (longest-chain) solution.
 *
 * The result carries `summary.chosenChainLength` (number, or null = unbounded),
 * `summary.ceilingItemsTraded`, and a `curve` of exchanges-vs-K for display.
 */
function solveAuto(items, opts = {}) {
  const maxK = opts.maxChainLength || AUTO_MAX_K;
  const tolerance = opts.tolerance ?? AUTO_TOLERANCE;
  const n = items.length;

  const unbounded = solveUnbounded(items);
  const ceiling = unbounded.summary.itemsTraded;
  const curve = [];

  if (n < 2 || ceiling === 0) {
    unbounded.summary.chosenChainLength = null;
    unbounded.summary.ceilingItemsTraded = ceiling;
    unbounded.curve = curve;
    return unbounded;
  }

  const target = Math.ceil((1 - tolerance) * ceiling);
  const { adj } = buildWantGraph(items);

  for (let K = 2; K <= maxK; K++) {
    const sel = boundedPacking(adj, n, K);
    const traded = sel.cycles.reduce((a, c) => a + c.length, 0);
    curve.push({ K, traded });
    if (traded >= target) {
      const result = decomposeCycles(
        cyclesToReceive(sel.cycles, n),
        items,
        sel.approximate,
      );
      result.summary.chosenChainLength = K;
      result.summary.ceilingItemsTraded = ceiling;
      result.curve = curve;
      return result;
    }
  }

  unbounded.summary.chosenChainLength = null; // null = cadena ilimitada
  unbounded.summary.ceilingItemsTraded = ceiling;
  unbounded.curve = curve;
  return unbounded;
}

// ── Output ─────────────────────────────────────────────────────────────────

/**
 * Turn a `receive` permutation (receive[i] = item index owner of i receives;
 * receive[i] === i means not traded) into the public result shape.
 */
function decomposeCycles(receive, items, approximate = false) {
  const n = items.length;
  const inverse = new Array(n);
  for (let i = 0; i < n; i++) inverse[receive[i]] = i;

  const perItem = items.map((it, i) => {
    const traded = receive[i] !== i;
    const recv = items[receive[i]];
    return {
      itemId: it.id,
      ownerId: it.ownerId,
      gameId: it.gameId,
      traded,
      receivesFromItem: traded ? recv.id : null,
      receivesGameId: traded ? recv.gameId : null,
      matchedGameId: traded ? recv.gameId : null,
      givesToItem: traded ? items[inverse[i]].id : null,
    };
  });

  const visited = new Array(n).fill(false);
  const cycles = [];
  for (let i = 0; i < n; i++) {
    if (visited[i] || receive[i] === i) {
      visited[i] = true;
      continue;
    }
    const nodes = [];
    let cur = i;
    while (!visited[cur]) {
      visited[cur] = true;
      nodes.push(cur);
      cur = receive[cur];
    }
    if (nodes.length >= 2) {
      cycles.push({
        length: nodes.length,
        items: nodes.map((idx) => {
          const recv = items[receive[idx]];
          return {
            itemId: items[idx].id,
            ownerId: items[idx].ownerId,
            gameId: items[idx].gameId,
            receivesItemId: recv.id,
            receivesGameId: recv.gameId,
          };
        }),
      });
    }
  }

  const itemsTraded = perItem.filter((p) => p.traded).length;
  const longestCycle = cycles.reduce((m, c) => Math.max(m, c.length), 0);

  return {
    perItem,
    cycles,
    summary: {
      itemsOffered: n,
      itemsTraded,
      cyclesCount: cycles.length,
      longestCycle,
      approximate,
      chosenChainLength: null,
    },
  };
}

function identity(n) {
  return Array.from({ length: n }, (_, i) => i);
}

module.exports = {
  buildWantGraph,
  solveUnbounded,
  solveBounded,
  solveAuto,
  decomposeCycles,
  // exposed for tests / tuning
  NOT_TRADED_PENALTY,
  DISALLOWED,
  MAX_CYCLES,
  BNB_CYCLE_LIMIT,
  AUTO_MAX_K,
  AUTO_TOLERANCE,
};

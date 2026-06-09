// Backfill: vincula los jugadores del snapshot `playResult` de cada juntada a su
// cuenta de TurnoCero (`userId`), derivándolo del @BGG — la misma regla que
// `routes/compartidas.js#sanitizePlayResult`. Así las juntadas creadas ANTES de
// la migración a referencia también muestran nombre/avatar en vivo.
//
// Idempotente. READ-ONLY salvo `--apply`.
//   node scripts/backfill-playresult-userid.js          # dry-run
//   node scripts/backfill-playresult-userid.js --apply  # persiste
require("dotenv").config();
// c-ares toma 127.0.0.1 como DNS en esta máquina y rechaza las consultas SRV de
// Atlas; forzamos un DNS público para que el lookup del cluster funcione.
require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose = require("mongoose");
const Compartida = require("../models/Compartida");
const User = require("../models/User");

const APPLY = process.argv.includes("--apply");
const idEq = (a, b) => String(a || "") === String(b || "");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const posts = await Compartida.find({
      "playResult.players.0": { $exists: true },
    }).select("_id playResult");
    console.log(`Juntadas con playResult: ${posts.length}`);

    // Un único lookup de @BGG → userId para toda la corrida.
    const handles = new Set();
    for (const post of posts)
      for (const p of post.playResult.players)
        if (!p.anonymous && p.username)
          handles.add(String(p.username).trim().toLowerCase());

    const userIdByHandle = new Map();
    if (handles.size) {
      const users = await User.find({ bggUsername: { $in: [...handles] } })
        .collation({ locale: "en", strength: 2 })
        .select("_id bggUsername");
      for (const u of users)
        if (u.bggUsername) userIdByHandle.set(u.bggUsername.toLowerCase(), u._id);
    }
    console.log(`@BGG distintos: ${handles.size} · con cuenta TC: ${userIdByHandle.size}`);

    let postsChanged = 0;
    let linksSet = 0;
    let linksCleared = 0;
    for (const post of posts) {
      let dirty = false;
      for (const p of post.playResult.players) {
        const handle =
          !p.anonymous && p.username
            ? String(p.username).trim().toLowerCase()
            : "";
        const next = handle ? userIdByHandle.get(handle) || null : null;
        if (!idEq(p.userId, next)) {
          if (next) linksSet++;
          else if (p.userId) linksCleared++;
          p.userId = next;
          dirty = true;
        }
      }
      if (dirty) {
        postsChanged++;
        if (APPLY) {
          post.markModified("playResult");
          await post.save();
        }
      }
    }

    console.log(
      `\nJuntadas a actualizar: ${postsChanged} · vínculos nuevos: ${linksSet} · limpiados: ${linksCleared}`,
    );
    console.log(APPLY ? "✓ Guardado." : "DRY-RUN. Re-corré con --apply para persistir.");
  } finally {
    await mongoose.disconnect();
  }
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exitCode = 1;
});

/**
 * One-shot migration: backfill BggPlay for users who connected BGG before
 * Phase 4's autosync-on-connect (and never clicked "Reconciliar tod0").
 *
 * Context: when Phase 5 introduced `triggerBackgroundReconcile` on
 * `POST /api/auth/bgg-connect`, pre-existing connected users were left
 * with empty BggPlay collections and undefined bggSync state. They'd see
 * the legacy BGG-XML fallback (no gameStats, no Mongo-served filters,
 * "Más jugado" derived from the collection only).
 *
 * The route-level self-healing trigger (added alongside this script) will
 * catch them lazily when they next visit /bg-watch. This script does the
 * same eagerly so users don't have to wait for a visit.
 *
 * Idempotent: users who already have BggPlay docs are skipped. Safe to
 * re-run after partial failures.
 *
 * Run:
 *   node server/scripts/migrate-bgg-sync-phase4.js
 *
 * Optional env:
 *   DRY_RUN=1   print what would be reconciled, do not actually trigger
 *   THROTTLE_MS=2000  delay between user triggers (default 2000)
 *   MAX_WAIT_MS=120000 per-user wait cap before moving on (default 120s)
 */

require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});
const mongoose = require("mongoose");
const User = require("../models/User");
const BggPlay = require("../models/BggPlay");

const DRY_RUN = process.env.DRY_RUN === "1";
const THROTTLE_MS = parseInt(process.env.THROTTLE_MS || "2000", 10);
const MAX_WAIT_MS = parseInt(process.env.MAX_WAIT_MS || "120000", 10);

function sleep(ms) {
  return new Promise((r) => {
    setTimeout(r, ms);
  });
}

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set. Aborting.");
    process.exit(1);
  }
  if (!process.env.BGG_CREDS_KEY) {
    console.error("BGG_CREDS_KEY is not set. Aborting.");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Eligible: has a bggUsername and was connected to BGG at some point.
    // We don't require an unexpired credential — the reconcile only needs
    // the public XML API. The credential check filters out users who
    // only put their bggUsername in their profile but never connected
    // (their plays are likely set to private on BGG too).
    const candidates = await User.find({
      bggUsername: { $exists: true, $ne: "" },
      "bggCredentials.encryptedPassword": { $exists: true, $ne: "" },
    })
      .select("_id username bggUsername bggSync")
      .lean();

    if (candidates.length === 0) {
      console.log("No connected BGG users found. Nothing to do.");
      return;
    }

    // Filter to those without BggPlay docs.
    const todo = [];
    for (const c of candidates) {
      const lower = c.bggUsername.toLowerCase();
      const has = await BggPlay.exists({ bggUsername: lower });
      if (!has) todo.push(c);
    }

    console.log(
      `Found ${candidates.length} connected BGG users; ${todo.length} need backfill.`,
    );
    if (todo.length === 0) return;

    if (DRY_RUN) {
      console.log("DRY_RUN=1 — would reconcile:");
      for (const c of todo) {
        console.log(`  - ${c.username} (bgg: ${c.bggUsername})`);
      }
      return;
    }

    // Lazy-load the bgg router so it doesn't try to load the section gate
    // middleware which depends on SiteConfig being warm.
    const bggRouter = require("../routes/bgg");

    let success = 0;
    let failed = 0;
    for (let i = 0; i < todo.length; i++) {
      const c = todo[i];
      const label = `[${i + 1}/${todo.length}] ${c.username} (${c.bggUsername})`;
      console.log(`${label} — triggering reconcile…`);

      const scheduled = bggRouter.triggerBackgroundReconcile(c.bggUsername);
      if (!scheduled) {
        // Slot cap (max 3) full — wait a bit before trying again.
        console.log(`  slot cap full, waiting 5s and retrying…`);
        await sleep(5000);
        const retry = bggRouter.triggerBackgroundReconcile(c.bggUsername);
        if (!retry) {
          console.log(
            `  still full; skipping (the route trigger will catch it later).`,
          );
          failed++;
          continue;
        }
      }

      // Poll for outcome
      const start = Date.now();
      let done = false;
      while (Date.now() - start < MAX_WAIT_MS) {
        const fresh = await User.findById(c._id).lean();
        if (fresh.bggSync?.lastFullSyncAt) {
          const count = await BggPlay.countDocuments({
            bggUsername: c.bggUsername.toLowerCase(),
          });
          console.log(
            `  ✓ ${count} plays reconciled (${Math.round((Date.now() - start) / 1000)}s)`,
          );
          success++;
          done = true;
          break;
        }
        await sleep(500);
      }
      if (!done) {
        console.log(
          `  ⏱  timeout after ${MAX_WAIT_MS}ms — will retry next visit.`,
        );
        failed++;
      }

      // Throttle between users to be friendly to BGG and to avoid
      // saturating the in-process slot cap.
      if (i < todo.length - 1) await sleep(THROTTLE_MS);
    }

    console.log(`\nDone. ${success} succeeded, ${failed} failed/skipped.`);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();

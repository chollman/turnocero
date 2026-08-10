import { execSync } from "node:child_process";

// Total commit count on HEAD, used as a monotonically increasing build number
// (no manual bookkeeping — it just IS the number of commits). Falls back to 0
// if git isn't available (e.g. a checkout with no history at all), so a
// missing history never fails the build.
//
// Vercel's default build clone is SHALLOW (--depth=10), which silently caps
// this count at ~10 forever instead of the real total. Set VERCEL_DEEP_CLONE=1
// as an env var on the Vercel project (client) to fetch full history during
// builds — see https://vercel.com/docs/builds/configure-a-build. We warn in
// the build log below if a shallow clone is detected, so the mismatch doesn't
// go unnoticed.
export function getCommitCount() {
  try {
    if (isShallowRepo()) {
      console.warn(
        "[getCommitCount] Shallow git clone detected — commit count will be truncated to the fetched history. Set VERCEL_DEEP_CLONE=1 on the Vercel project for an accurate count.",
      );
    }
    return parseInt(
      execSync("git rev-list --count HEAD", {
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim(),
      10,
    );
  } catch {
    return 0;
  }
}

function isShallowRepo() {
  try {
    return (
      execSync("git rev-parse --is-shallow-repository", {
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim() === "true"
    );
  } catch {
    return false;
  }
}

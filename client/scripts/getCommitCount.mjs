import { execSync } from "node:child_process";

// Total commit count on HEAD, used as a monotonically increasing build number
// (no manual bookkeeping — it just IS the number of commits). Falls back to 0
// if git isn't available (e.g. a shallow-cloned CI checkout with no history),
// so a missing/short history never fails the build.
export function getCommitCount() {
  try {
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

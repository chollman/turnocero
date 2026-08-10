import { execSync } from "node:child_process";

// Total commit count reachable from HEAD — a monotonically increasing build
// number with no manual bookkeeping (it just IS the commit count). Vercel's
// build clone is always shallow (fixed --depth=10, no supported override —
// the undocumented VERCEL_DEEP_CLONE trick broke cloning entirely, see commit
// 354b2a1), so a plain `git rev-list --count HEAD` would be wrong in
// production. Instead, when the local clone is shallow, ask GitHub's API for
// the true count via the `Link: rel="last"` pagination trick (per_page=1
// means the last page number IS the total commit count) — GitHub always has
// full history regardless of how deep the local clone is.
export async function getCommitCount() {
  const sha = currentSha();
  if (sha && isShallowRepo()) {
    try {
      return await githubCommitCount(sha);
    } catch {
      // GitHub unreachable/rate-limited — fall through to whatever the
      // shallow clone can see, so the badge degrades instead of breaking.
    }
  }
  try {
    return localCount();
  } catch {
    return 0;
  }
}

function currentSha() {
  try {
    return execSync("git rev-parse HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return null;
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

function localCount() {
  return parseInt(
    execSync("git rev-list --count HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim(),
    10,
  );
}

function repoSlug() {
  try {
    const url = execSync("git config --get remote.origin.url", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    const match = url.match(/github\.com[:/]([^/]+\/[^/.]+?)(\.git)?$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function githubCommitCount(sha) {
  const slug = repoSlug();
  if (!slug) throw new Error("Could not resolve GitHub repo slug");
  const res = await fetch(
    `https://api.github.com/repos/${slug}/commits?sha=${sha}&per_page=1`,
    { headers: { "User-Agent": "turnocero-build" } },
  );
  if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
  const link = res.headers.get("link") || "";
  const match = link.match(/[?&]page=(\d+)>;\s*rel="last"/);
  if (match) return parseInt(match[1], 10);
  // No "last" link means everything fit on page 1 — exactly one commit total.
  return 1;
}

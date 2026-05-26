#!/usr/bin/env node
/**
 * PreToolUse hook for `mcp__Claude_Preview__preview_eval`.
 *
 * If the call targets the Turnocero preview client, this script:
 *   1. Loads the test credentials from `.claude/memory/reference_test_credentials.md`
 *   2. Reuses a cached JWT from `.claude/cache/turnocero-token.json` if still valid
 *   3. Otherwise POSTs to `http://127.0.0.1:4000/api/auth/login` to obtain a new token
 *   4. Emits `additionalContext` with a snippet Claude can paste into preview_eval
 *
 * The password never appears in the tool input or stdout — only the resulting
 * JWT (which itself is a short-lived test credential) is surfaced to Claude.
 *
 * Failures (no creds file, backend down, parse error, etc.) exit 0 silently so
 * `preview_eval` is never blocked.
 */

const fs = require("fs");
const path = require("path");
const http = require("http");

const PROJECT_ROOT = process.cwd();
const CRED_PATH = path.join(
  PROJECT_ROOT,
  ".claude",
  "memory",
  "reference_test_credentials.md",
);
const CACHE_PATH = path.join(
  PROJECT_ROOT,
  ".claude",
  "cache",
  "turnocero-token.json",
);
const BACKEND_HOST = "127.0.0.1";
const BACKEND_PORT = 4000;

async function main() {
  // Read tool input from stdin (we don't use it directly, but consume it so
  // the parent doesn't see a broken pipe).
  await readStdin();

  // Only fire if this looks like the Turnocero project (creds file present).
  if (!fs.existsSync(CRED_PATH)) return;

  const now = Math.floor(Date.now() / 1000);

  // Try cached token first (refresh if < 60s of validity left).
  let token = readCachedToken(now);
  if (!token) {
    const creds = parseCredentials(CRED_PATH);
    if (!creds) return;
    token = await login(creds.email, creds.password);
    if (!token) return; // backend probably not running — fail silent
    persistToken(token, now);
  }

  emitContext(token);
}

function readStdin() {
  return new Promise((resolve) => {
    let buf = "";
    process.stdin.on("data", (c) => {
      buf += c;
    });
    process.stdin.on("end", () => resolve(buf));
    process.stdin.on("error", () => resolve(""));
    // If nothing is piped, resolve quickly so we don't hang.
    setTimeout(() => resolve(buf), 50);
  });
}

function readCachedToken(now) {
  try {
    const raw = fs.readFileSync(CACHE_PATH, "utf8");
    const { token, exp } = JSON.parse(raw);
    if (token && typeof exp === "number" && exp > now + 60) return token;
  } catch {
    /* no cache or corrupted — ignore */
  }
  return null;
}

function parseCredentials(filePath) {
  try {
    const md = fs.readFileSync(filePath, "utf8");
    const email = md.match(/Email:\s*`([^`]+)`/)?.[1];
    const password = md.match(/Password:\s*`([^`]+)`/)?.[1];
    if (!email || !password) return null;
    return { email, password };
  } catch {
    return null;
  }
}

function login(email, password) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ email, password });
    const req = http.request(
      {
        method: "POST",
        host: BACKEND_HOST,
        port: BACKEND_PORT,
        path: "/api/auth/login",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 3000,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => {
          data += c;
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.token || null);
          } catch {
            resolve(null);
          }
        });
      },
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
    req.write(body);
    req.end();
  });
}

function persistToken(token, now) {
  let exp = now + 60 * 60 * 23; // fallback: 23h
  try {
    const payloadB64 = token.split(".")[1];
    const padded = payloadB64 + "=".repeat((4 - (payloadB64.length % 4)) % 4);
    const decoded = Buffer.from(
      padded.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    const payload = JSON.parse(decoded);
    if (typeof payload.exp === "number") exp = payload.exp;
  } catch {
    /* keep fallback exp */
  }
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(
      CACHE_PATH,
      JSON.stringify({ token, exp, savedAt: now }),
      "utf8",
    );
  } catch {
    /* cache write failure shouldn't block the hook */
  }
}

function emitContext(token) {
  const snippet = [
    "localStorage.setItem('turnocero_token', token);",
    "if (window.axios) window.axios.defaults.headers.common.Authorization = 'Bearer ' + token;",
  ].join("\n");
  const additionalContext = [
    "Test JWT cached for the Turnocero preview client (read from .claude/cache/turnocero-token.json).",
    "",
    `Token: \`${token}\``,
    "",
    "To authenticate inside preview_eval (port 3000), prepend this to your expression:",
    "",
    "```js",
    `const token = '${token}';`,
    snippet,
    "```",
    "",
    "For fetches that bypass axios, pass `Authorization: \\`Bearer ${token}\\`` as a header. " +
      "The token refreshes automatically on the next preview_eval after it expires.",
  ].join("\n");

  const out = {
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext,
    },
  };
  process.stdout.write(JSON.stringify(out));
}

main().catch(() => {
  /* swallow */
});

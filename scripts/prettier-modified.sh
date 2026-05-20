#!/usr/bin/env bash
# Formats and lints files that Claude Code modified during the current turn.
#
# Triggered by the Stop hook in .claude/settings.json. Pairs with a
# PostToolUse hook that appends each Edit/Write/MultiEdit target path to
# the queue file.
#
# Pipeline per turn:
#   1. Drain + dedupe the queue.
#   2. Prettier --write --ignore-unknown over every file (skips unparseable).
#   3. ESLint --fix per workspace (client/ and server/) — invoked via each
#      workspace's local binary so the flat config walks up correctly.
#      Files outside those workspaces skip the lint step.
#
# Idempotent:
#   - No queue file → exit 0
#   - Queue exists but empty → exit 0
#   - Files in queue that no longer exist → skipped (Edit could've been
#     on a path that was renamed/deleted later in the turn)
#
# Errors in prettier / eslint never break the Stop hook (|| true). Real
# diagnostics go to stderr for visibility.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QUEUE_FILE="${PRETTIER_QUEUE_FILE:-/tmp/turnocero-prettier-queue.txt}"

[ -f "$QUEUE_FILE" ] || exit 0

# Drain and dedupe in one shot. Truncate before formatting so a slow
# format doesn't drop appends from the next turn.
files=$(sort -u "$QUEUE_FILE" | sed '/^$/d' || true)
: > "$QUEUE_FILE"

[ -z "$files" ] && exit 0

# Filter to paths that still exist as regular files.
existing=()
while IFS= read -r f; do
  [ -f "$f" ] && existing+=("$f")
done <<< "$files"

[ "${#existing[@]}" -eq 0 ] && exit 0

cd "$REPO_ROOT"

# ── 1. Prettier ──────────────────────────────────────────────────────
# --no-install: rely on the locally-installed prettier (added as devDep
# at root); fail fast if it's missing instead of downloading silently.
# --log-level=warn: quiet on successful format, noisy on real problems.
npx --no-install prettier --write --ignore-unknown --log-level=warn "${existing[@]}" || true

# ── 2. ESLint --fix per workspace ────────────────────────────────────
# Group files by workspace prefix so each invocation uses the correct
# flat config (client/eslint.config.js, server/eslint.config.js). Files
# outside both workspaces are skipped — no config applies to them.
client_files=()
server_files=()
for f in "${existing[@]}"; do
  # Normalize to absolute then strip the repo root for the prefix check
  abs="$(cd "$(dirname "$f")" && pwd)/$(basename "$f")"
  rel="${abs#$REPO_ROOT/}"
  case "$rel" in
    client/*) client_files+=("$abs") ;;
    server/*) server_files+=("$abs") ;;
  esac
done

run_eslint() {
  local workspace="$1"; shift
  local bin="$REPO_ROOT/$workspace/node_modules/.bin/eslint"
  if [ ! -x "$bin" ]; then
    return 0  # workspace not installed — skip silently
  fi
  # Filter to extensions ESLint will recognize. --no-error-on-unmatched-pattern
  # keeps it quiet when all paths get filtered out.
  local lintable=()
  for f in "$@"; do
    case "$f" in
      *.js|*.jsx|*.ts|*.tsx|*.mjs|*.cjs) lintable+=("$f") ;;
    esac
  done
  [ "${#lintable[@]}" -eq 0 ] && return 0
  (cd "$REPO_ROOT/$workspace" && "$bin" --fix --no-error-on-unmatched-pattern "${lintable[@]}") || true
}

[ "${#client_files[@]}" -gt 0 ] && run_eslint client "${client_files[@]}"
[ "${#server_files[@]}" -gt 0 ] && run_eslint server "${server_files[@]}"

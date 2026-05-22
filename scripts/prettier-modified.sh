#!/usr/bin/env bash
# Format + lint files Claude Code touched in the current turn.
#
# Wired in .claude/settings.json:
#   - PostToolUse hook on Edit|Write|MultiEdit appends each tool_input.file_path
#     to /tmp/turnocero-prettier-queue.txt (one path per line, can repeat).
#   - Stop hook runs this script at the end of the turn.
#
# Pipeline:
#   1. Drain + dedupe the queue, then truncate so the next turn starts clean.
#   2. Prettier --write --ignore-unknown across every surviving path.
#   3. ESLint --fix per workspace (client/, server/) using each workspace's
#      local binary so its flat config resolves from the right CWD.
#
# Idempotent and silent on the happy path:
#   - Missing queue file        → exit 0
#   - Empty queue               → exit 0
#   - Paths that no longer exist (renamed / deleted later in the turn) skipped
#   - Paths outside client/ and server/ skip the lint step (no flat config)
#   - Prettier / ESLint failures never break the Stop hook (`|| true`)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QUEUE_FILE="${PRETTIER_QUEUE_FILE:-/tmp/turnocero-prettier-queue.txt}"

[ -f "$QUEUE_FILE" ] || exit 0

# Snapshot + truncate atomically-ish: a slow format must not drop appends
# that the next turn's PostToolUse hook may add while we run.
queued="$(sort -u "$QUEUE_FILE" | sed '/^$/d' || true)"
: > "$QUEUE_FILE"

[ -z "$queued" ] && exit 0

# Keep only paths that still resolve to a regular file in the working tree.
existing=()
while IFS= read -r path; do
  [ -f "$path" ] && existing+=("$path")
done <<< "$queued"

[ "${#existing[@]}" -eq 0 ] && exit 0

cd "$REPO_ROOT"

# ── 1. Prettier ─────────────────────────────────────────────────────────
# --no-install: rely on the locally-installed prettier (root devDep). Fail
# fast if it's missing instead of silently downloading at hook time.
# --ignore-unknown: skip files prettier doesn't have a parser for.
# --log-level=warn: quiet on success, noisy on real diagnostics.
npx --no-install prettier --write --ignore-unknown --log-level=warn "${existing[@]}" || true

# ── 2. ESLint --fix per workspace ───────────────────────────────────────
# Each workspace has its own flat config (client/eslint.config.js,
# server/eslint.config.js) that must resolve from inside the workspace.
# Bucket the queue by prefix; ignore everything outside both workspaces.
client_files=()
server_files=()
for path in "${existing[@]}"; do
  abs="$(cd "$(dirname "$path")" && pwd)/$(basename "$path")"
  rel="${abs#"$REPO_ROOT"/}"
  case "$rel" in
    client/*) client_files+=("$abs") ;;
    server/*) server_files+=("$abs") ;;
  esac
done

run_eslint() {
  local workspace="$1"; shift
  local bin="$REPO_ROOT/$workspace/node_modules/.bin/eslint"
  [ -x "$bin" ] || return 0  # workspace not installed yet — skip

  local lintable=()
  for f in "$@"; do
    case "$f" in
      *.js|*.jsx|*.ts|*.tsx|*.mjs|*.cjs) lintable+=("$f") ;;
    esac
  done
  [ "${#lintable[@]}" -eq 0 ] && return 0

  (cd "$REPO_ROOT/$workspace" \
    && "$bin" --fix --no-error-on-unmatched-pattern "${lintable[@]}") || true
}

[ "${#client_files[@]}" -gt 0 ] && run_eslint client "${client_files[@]}"
[ "${#server_files[@]}" -gt 0 ] && run_eslint server "${server_files[@]}"

#!/bin/bash
# PostToolUse hook: runs ESLint on any React file edited inside client/src/
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

[[ -z "$FILE" ]] && exit 0
[[ "$FILE" =~ client/src/.*\.(jsx|js)$ ]] || exit 0

REPO_ROOT="$(git -C "$(dirname "$FILE")" rev-parse --show-toplevel 2>/dev/null)"
[[ -z "$REPO_ROOT" ]] && exit 0

cd "$REPO_ROOT/client" || exit 0

OUTPUT=$(npx eslint "$FILE" --max-warnings 0 2>&1)
EXIT_CODE=$?

if [[ $EXIT_CODE -ne 0 ]]; then
  echo "ESLint encontró problemas en $(basename "$FILE"):"
  echo "$OUTPUT"
fi

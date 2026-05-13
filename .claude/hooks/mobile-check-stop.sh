#!/bin/bash
# Stop hook: if client/src UI files were modified, prompt Claude to run /mobile-review

MODIFIED=$(git diff --name-only HEAD 2>/dev/null | grep -E "client/src/.*\.(jsx|js|css)$")

if [[ -z "$MODIFIED" ]]; then
  # Also check last commit if working tree is clean
  MODIFIED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -E "client/src/.*\.(jsx|js|css)$")
fi

[[ -z "$MODIFIED" ]] && exit 0

FILE_LIST=$(echo "$MODIFIED" | sed 's/^/  - /' | head -10)

cat <<EOF
Se modificaron archivos de UI en esta sesión:
$FILE_LIST

Por favor ejecutá /mobile-review para verificar que los cambios se vean correctamente en mobile antes de dar la tarea por terminada.
EOF

exit 2

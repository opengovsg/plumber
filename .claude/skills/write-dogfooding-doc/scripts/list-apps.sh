#!/usr/bin/env bash
# Lists every Plumber app with its triggers and actions, as a Markdown table.
# Usage: list-apps.sh [path to packages/backend/src/apps] (default: repo root of cwd)
set -euo pipefail

APPS_DIR="${1:-$(git rev-parse --show-toplevel)/packages/backend/src/apps}"
[ -d "$APPS_DIR" ] || { echo "No apps directory at $APPS_DIR" >&2; exit 1; }

# Top-level fields sit at two-space indent. Deeper `name:` keys are error
# messages or field labels, not the app or event name.
field() { grep -m1 -E "^  $2: *['\"\`]" "$1" 2>/dev/null | sed -E "s/^  $2: *['\"\`]([^'\"\`]*).*/\1/"; }

events() {
  local dir="$1" out=""
  [ -d "$dir" ] || return 0
  for f in "$dir"/*/index.ts "$dir"/*.ts; do
    [ -f "$f" ] || continue
    case "$f" in *index.ts) [ "$(dirname "$f")" = "$dir" ] && continue ;; esac
    case "$f" in *__tests__*|*.test.ts|*/common/*) continue ;; esac
    local name hidden=""
    name=$(field "$f" name)
    [ -n "$name" ] || continue
    grep -q -E "^  hiddenFromUser: true" "$f" && hidden=" (hidden)"
    out+="${out:+, }${name}${hidden}"
  done
  echo "$out"
}

echo "| App | Key | Needs connection | Triggers | Actions |"
echo "| --- | --- | --- | --- | --- |"
for app in "$APPS_DIR"/*/; do
  index="$app/index.ts"
  [ -f "$index" ] || continue
  key=$(basename "$app")
  name=$(field "$index" name)
  connection=no
  grep -q -E "^  auth[,:]" "$index" && connection=yes
  echo "| $name | $key | $connection | $(events "$app/triggers") | $(events "$app/actions") |"
done

#!/usr/bin/env bash
# Cursor cannot rewrite a shell command, so this hook denies it.
# Cloud shells prepend `cd`, and that image already has the pinned Node on PATH.
input=$(cat)

decision=$(printf '%s' "$input" | jq -r '
  def tool: "(?:^|[^\\w./])(?:npm|npx|pnpm|node)(?![\\w.-])";
  if (.command | type != "string") then "allow"
  elif (.command | test(tool) | not) then "allow"
  elif (
    .command
    | capture("(?<pre>[\\s\\S]*?)" + tool).pre
    | test("nvm use\\b[^&|;]*&&")
  ) then "allow"
  else "check"
  end
')

if [ "$decision" = "allow" ]; then
  printf '%s\n' '{"permission":"allow"}'
  exit 0
fi

repo=$(CDPATH= cd "$(dirname "$0")/../.." && pwd)
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty')
search=$repo
if [ -n "$cwd" ] && [ -d "$cwd" ]; then
  search=$(CDPATH= cd "$cwd" && pwd)
fi

case "$search" in
  "$repo"|"$repo"/*) ;;
  *) search=$repo ;;
esac

nvmrc=""
dir=$search
while true; do
  if [ -f "$dir/.nvmrc" ]; then
    nvmrc=$dir/.nvmrc
    break
  fi
  if [ "$dir" = "$repo" ] || [ "$dir" = "/" ]; then
    break
  fi
  dir=$(dirname "$dir")
done

normalize() {
  printf '%s' "$1" | tr -d '[:space:]' | sed 's/^v//'
}

expected=""
if [ -n "$nvmrc" ]; then
  expected=$(normalize "$(cat "$nvmrc")")
fi
actual=$(normalize "$(node -v 2>/dev/null || true)")

if [ -n "$expected" ] && [ "$actual" = "$expected" ]; then
  printf '%s\n' '{"permission":"allow"}'
  exit 0
fi

printf '%s\n' '{"permission":"deny","agent_message":"Active node does not match .nvmrc. Run `nvm use &&` before npm, npx, pnpm, or node. A leading cd is fine."}'

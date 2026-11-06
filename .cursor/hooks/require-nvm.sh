#!/usr/bin/env bash
# Cursor cannot rewrite a command, so this hook denies it.
# npm, npx, pnpm, and node must use the .nvmrc of the directory they run in.
# A cd target that does not exist yet keeps the starting pin. mkdir has not run.
input=$(cat)
command=$(printf '%s' "$input" | jq -r '.command // empty')
repo=$(CDPATH= cd "$(dirname "$0")/../.." && pwd)
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty')
start=$repo
if [ -n "$cwd" ] && [ -d "$cwd" ]; then
  start=$(CDPATH= cd "$cwd" && pwd)
fi

allow() { printf '%s\n' '{"permission":"allow"}'; exit 0; }
deny() {
  printf '%s\n' '{"permission":"deny","agent_message":"Active node does not match .nvmrc. Run nvm use && before npm, npx, pnpm, or node. A leading cd is fine when that directory uses the same pin."}'
  exit 0
}

# Single quotes are literal, so they cannot count as nvm use or as a tool.
shown=$(printf '%s' "$command" | sed "s/'[^']*'//g")
tool='(^|[^[:alnum:]_.])(npm|npx|pnpm|node)([^[:alnum:]_./-]|$)'
if ! printf '%s' "$shown" | grep -Eq "$tool"; then
  allow
fi

# Text after the last plain cd. nvm use there selects that directory.
rest=$shown
if printf '%s' "$shown" | grep -Eq '(^|[[:space:];|&])cd[[:space:]]'; then
  rest=$(printf '%s' "$shown" | sed -E 's/.*cd[[:space:]]+[^;&|]*//')
fi
if printf '%s' "$rest" | grep -Eq '(^|[[:space:];|&])nvm use[[:space:]]*[^&|;]*&&'; then
  allow
fi

dir=$start
dest=$(printf '%s' "$shown" | grep -oE '(^|[[:space:];|&])cd[[:space:]]+[^[:space:];|&$]+' | tail -n 1 | sed -E 's/.*cd[[:space:]]+//')
if [ -n "$dest" ]; then
  case $dest in
    /*) candidate=$dest ;;
    *) candidate=${start%/}/$dest ;;
  esac
  if [ -d "$candidate" ]; then
    dir=$candidate
  fi
fi
if [ "$dir" = "$start" ]; then
  case $dir in
    "$repo"|"$repo"/*) ;;
    *) dir=$repo ;;
  esac
fi

pin=
search=$dir
while true; do
  if [ -f "$search/.nvmrc" ]; then
    pin=$(tr -d '[:space:]v' < "$search/.nvmrc")
    break
  fi
  [ "$search" = "$repo" ] || [ "$search" = / ] && break
  case $search in
    "$repo"/*) search=$(dirname "$search") ;;
    *) break ;;
  esac
done
active=$(node -v 2>/dev/null | tr -d '[:space:]v')
if [ -n "$pin" ] && [ "$active" = "$pin" ]; then
  allow
fi
deny

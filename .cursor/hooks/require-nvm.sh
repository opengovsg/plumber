#!/usr/bin/env bash
# Cursor cannot rewrite a command, so this hook denies it.
# Matching node -v is enough. Cloud shells prepend a cd.
input=$(cat)
command=$(printf '%s' "$input" | jq -r '.command // empty')
repo=$(CDPATH= cd "$(dirname "$0")/../.." && pwd)
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty')
dir=$repo
case $cwd in
  "$repo"|"$repo"/*) dir=$cwd ;;
esac
pin=$(tr -d '[:space:]v' < "$repo/.nvmrc")
while [ "$dir" != "$repo" ] && [ "$dir" != / ] && [ ! -f "$dir/.nvmrc" ]; do
  dir=$(dirname "$dir")
done
if [ -f "$dir/.nvmrc" ]; then
  pin=$(tr -d '[:space:]v' < "$dir/.nvmrc")
fi
active=$(node -v 2>/dev/null | tr -d '[:space:]v')
rest=$(printf '%s' "$command" | sed -E 's/^[[:space:]]*cd[[:space:]]+[^;&|]*&&[[:space:]]*//')
if ! printf '%s' "$command" | grep -Eq '(^|[^[:alnum:]_.])(npm|npx|pnpm|node)([^[:alnum:]_./-]|$)'; then
  ok=1
elif printf '%s' "$rest" | grep -Eq '^[[:space:]]*nvm use[[:space:]]*[^&|;]*&&'; then
  ok=1
elif [ "$active" = "$pin" ]; then
  ok=1
else
  ok=0
fi
if [ "$ok" = 1 ]; then
  printf '%s\n' '{"permission":"allow"}'
else
  printf '%s\n' '{"permission":"deny","agent_message":"Run nvm use && before npm, npx, pnpm, or node. A leading cd is fine."}'
fi

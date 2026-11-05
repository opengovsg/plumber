#!/usr/bin/env bash
# Cursor cannot rewrite a shell command, so this hook denies it.
# A leading cd stays allowed when that directory uses the same Node pin.
# Text inside quotes is not an executed nvm use.
input=$(cat)

blank_quotes() {
  local s=$1
  local out="" q="" i=0 c
  local n=${#s}
  while [ "$i" -lt "$n" ]; do
    c=${s:i:1}
    if [ -n "$q" ]; then
      if [ "$q" = '"' ] && [ "$c" = '\' ]; then
        i=$((i + 2))
        continue
      fi
      if [ "$c" = "$q" ]; then
        q=""
      fi
      i=$((i + 1))
      continue
    fi
    if [ "$c" = "'" ] || [ "$c" = '"' ]; then
      q=$c
      out="$out "
      i=$((i + 1))
      continue
    fi
    out="$out$c"
    i=$((i + 1))
  done
  printf '%s' "$out"
}

unwrap_quotes() {
  local s=$1
  local out="" q="" i=0 c
  local n=${#s}
  while [ "$i" -lt "$n" ]; do
    c=${s:i:1}
    if [ -n "$q" ]; then
      if [ "$q" = '"' ] && [ "$c" = '\' ]; then
        i=$((i + 1))
        if [ "$i" -lt "$n" ]; then
          out="$out${s:i:1}"
        fi
        i=$((i + 1))
        continue
      fi
      if [ "$c" = "$q" ]; then
        q=""
        i=$((i + 1))
        continue
      fi
      out="$out$c"
      i=$((i + 1))
      continue
    fi
    if [ "$c" = "'" ] || [ "$c" = '"' ]; then
      q=$c
      i=$((i + 1))
      continue
    fi
    out="$out$c"
    i=$((i + 1))
  done
  printf '%s' "$out"
}

command=$(printf '%s' "$input" | jq -r '.command // empty')
blank=$(blank_quotes "$command")

decision=$(printf '%s' "$blank" | jq -Rr '
  def tool: "(?<![\\w./])(?:npm|npx|pnpm|node)(?![\\w.-])";
  def armed: "(?:^|&&|;|\\||\\|\\|)\\s*nvm use\\b[^&|;]*&&";
  if test(tool) | not then "allow"
  elif capture("(?<pre>[\\s\\S]*?)" + tool).pre | test(armed) then "allow"
  else "check"
  end
')

if [ "$decision" = "allow" ]; then
  printf '%s\n' '{"permission":"allow"}'
  exit 0
fi

repo=$(CDPATH= cd "$(dirname "$0")/../.." && pwd)
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty')
start=$repo
if [ -n "$cwd" ] && [ -d "$cwd" ]; then
  start=$(CDPATH= cd "$cwd" && pwd)
fi

trim() {
  local s=$1
  s=${s#"${s%%[![:space:]]*}"}
  s=${s%"${s##*[![:space:]]}"}
  printf '%s' "$s"
}

plain=$(unwrap_quotes "$command")
prefix=$(printf '%s' "$plain" | jq -Rr '
  def tool: "(?<![\\w./])(?:npm|npx|pnpm|node)(?![\\w.-])";
  if test(tool) then capture("(?<pre>[\\s\\S]*?)" + tool).pre else "" end
')

search=$start
ambiguous=0
saw_cd=0

segments=$(printf '%s\n' "$prefix" | sed -e 's/&&/\n/g' -e 's/||/\n/g' -e 's/[;|]/\n/g')
while IFS= read -r seg || [ -n "$seg" ]; do
  seg=$(trim "$seg")
  case "$seg" in
    cd|cd[[:space:]]*)
      saw_cd=1
      dest=$(trim "${seg#cd}")
      if [ -z "$dest" ]; then
        search=$HOME
        continue
      fi
      case "$dest" in
        '~')
          search=$HOME
          ;;
        '~'/*)
          search=$HOME/${dest#'~'/}
          ;;
        -*|*' '*|*'$*'|*'${'*|*'`'*|*'('*|*')'*)
          ambiguous=1
          ;;
        /*)
          search=$dest
          ;;
        *)
          search=${search%/}/$dest
          ;;
      esac
      ;;
  esac
done <<EOF
$segments
EOF

if [ "$saw_cd" -eq 1 ] && [ "$ambiguous" -eq 0 ] && [ -d "$search" ]; then
  search=$(CDPATH= cd "$search" && pwd)
fi

if [ "$ambiguous" -eq 1 ]; then
  search=""
elif [ "$saw_cd" -eq 0 ]; then
  case "$start" in
    "$repo"|"$repo"/*) search=$start ;;
    *) search=$repo ;;
  esac
fi

nvmrc=""
if [ -n "$search" ] && [ -d "$search" ]; then
  dir=$search
  while true; do
    if [ -f "$dir/.nvmrc" ]; then
      nvmrc=$dir/.nvmrc
      break
    fi
    case "$dir" in
      "$repo"|"/") break ;;
    esac
    case "$dir" in
      "$repo"/*) ;;
      *) break ;;
    esac
    dir=$(dirname "$dir")
  done
fi

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

printf '%s\n' '{"permission":"deny","agent_message":"Active node does not match the .nvmrc where the tool runs. Run `nvm use &&` before npm, npx, pnpm, or node. A leading cd is fine when that directory uses the same pin."}'

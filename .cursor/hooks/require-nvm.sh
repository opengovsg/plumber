#!/usr/bin/env bash
# Cursor cannot rewrite a shell command, so this hook denies it.
# A tool must match the .nvmrc of the directory where that tool runs.
# Single quotes are literal. Command substitutions and shell -c strings still run.
input=$(cat)

command=$(printf '%s' "$input" | jq -r '.command // empty')
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

normalize() {
  printf '%s' "$1" | tr -d '[:space:]' | sed 's/^v//'
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

# Keeps text that the shell will execute. Drops single-quoted literals.
# Copies a shell -c script and any $(...) or backtick substitution.
bt=$(printf '\140')

expose_executed() {
  local s=$1
  local out="" word="" last="" q=""
  local pending_c=0 i=0 c
  local n=${#s}
  note_word() {
    if [ "$word" = "-c" ] && { [ "$last" = "bash" ] || [ "$last" = "sh" ] || [ "$last" = "zsh" ] || [ "$last" = "dash" ]; }; then
      pending_c=1
    elif [ -n "$word" ]; then
      pending_c=0
    fi
    if [ -n "$word" ]; then
      last=$word
    fi
    word=""
  }
  while [ "$i" -lt "$n" ]; do
    c=${s:i:1}
    if [ -n "$q" ]; then
      if [ "$q" = '"' ] && [ "$c" = '\' ]; then
        if [ "$pending_c" -eq 1 ]; then
          out="$out$c"
          i=$((i + 1))
          if [ "$i" -lt "$n" ]; then
            out="$out${s:i:1}"
          fi
        else
          i=$((i + 1))
        fi
        i=$((i + 1))
        continue
      fi
      if [ "$c" = "$q" ]; then
        q=""
        pending_c=0
        i=$((i + 1))
        continue
      fi
      if [ "$pending_c" -eq 1 ]; then
        out="$out$c"
        i=$((i + 1))
        continue
      fi
      if [ "$q" = '"' ] && [ "$c" = '$' ] && [ $((i + 1)) -lt "$n" ] && [ "${s:i+1:1}" = '(' ]; then
        out="$out("
        i=$((i + 2))
        local depth=1
        while [ "$i" -lt "$n" ] && [ "$depth" -gt 0 ]; do
          c=${s:i:1}
          out="$out$c"
          if [ "$c" = '(' ]; then
            depth=$((depth + 1))
          elif [ "$c" = ')' ]; then
            depth=$((depth - 1))
          fi
          i=$((i + 1))
        done
        continue
      fi
      if [ "$q" = '"' ] && [ "$c" = "$bt" ]; then
        out="$out$c"
        i=$((i + 1))
        while [ "$i" -lt "$n" ]; do
          c=${s:i:1}
          out="$out$c"
          i=$((i + 1))
          if [ "$c" = "$bt" ]; then
            break
          fi
        done
        continue
      fi
      i=$((i + 1))
      continue
    fi
    if [ "$c" = "'" ] || [ "$c" = '"' ]; then
      note_word
      q=$c
      i=$((i + 1))
      continue
    fi
    case "$c" in
      [[:space:]])
        note_word
        out="$out$c"
        i=$((i + 1))
        ;;
      *)
        word="$word$c"
        out="$out$c"
        i=$((i + 1))
        ;;
    esac
  done
  printf '%s' "$out"
}

has_tool() {
  local s=$1
  # A leading slash is a path. The next character still cannot be a slash,
  # so versions/node/v1 does not count as running node.
  [[ $s =~ (^|[^[:alnum:]_.])(npm|npx|pnpm|node)([^[:alnum:]_./-]|$) ]]
}

pin_of() {
  local dir=$1
  local outside_fallback=$2
  local search=$dir
  if [ "$outside_fallback" -eq 1 ]; then
    case "$dir" in
      "$repo"|"$repo"/*) ;;
      *) search=$repo ;;
    esac
  fi
  if [ ! -d "$search" ]; then
    return 0
  fi
  search=$(CDPATH= cd "$search" && pwd)
  while true; do
    if [ -f "$search/.nvmrc" ]; then
      normalize "$(cat "$search/.nvmrc")"
      return 0
    fi
    case "$search" in
      "$repo"|"/") return 0 ;;
    esac
    case "$search" in
      "$repo"/*) ;;
      *) return 0 ;;
    esac
    search=$(dirname "$search")
  done
}

apply_cd() {
  local dest=$1
  case "$dest" in
    ''|'~')
      search=$HOME
      ;;
    '~'/*)
      search=$HOME/${dest#'~'/}
      ;;
    -*)
      dir_known=0
      return 0
      ;;
    /*)
      search=$dest
      ;;
    *)
      search=${search%/}/$dest
      ;;
  esac
  case "$dest" in
    *[[:space:]]*|*'$*'|*'${'*|*'('*|*')'*)
      dir_known=0
      return 0
      ;;
  esac
  if [ -n "$bt" ] && [ "$dest" != "${dest%%"$bt"*}" ]; then
    dir_known=0
    return 0
  fi
  if [ -d "$search" ]; then
    search=$(CDPATH= cd "$search" && pwd)
  fi
}

# Prints PIN, UNKNOWN, or an explicit version.
# Only a bare nvm use, or the no-op flags, means the directory pin.
version_from_nvm_use() {
  local shown=$1
  local rest token
  local saw_unknown=0
  rest=$(trim "${shown#nvm use}")
  while [ -n "$rest" ]; do
    token=${rest%%[[:space:]]*}
    rest=$(trim "${rest#"$token"}")
    case "$token" in
      --silent|--delete-prefix|--) ;;
      -*)
        saw_unknown=1
        ;;
      *)
        if [ "$saw_unknown" -eq 1 ]; then
          printf '%s' "UNKNOWN"
        else
          normalize "$token"
        fi
        return 0
        ;;
    esac
  done
  if [ "$saw_unknown" -eq 1 ]; then
    printf '%s' "UNKNOWN"
  else
    printf '%s' "PIN"
  fi
}

blocked=0
search=$start
dir_known=1
explicit_cd=0
active=$(normalize "$(node -v 2>/dev/null || true)")
seg=""

consider_segment() {
  local op=$1
  local raw
  raw=$(trim "$seg")
  seg=""
  if [ -z "$raw" ] || [ "$blocked" -eq 1 ]; then
    return 0
  fi
  local opened shown
  opened=$(trim "$(unwrap_quotes "$raw")")
  while [ "${opened#\(}" != "$opened" ]; do
    opened=$(trim "${opened#\(}")
  done
  case "$opened" in
    cd|cd[[:space:]]*)
      explicit_cd=1
      apply_cd "$(trim "${opened#cd}")"
      return 0
      ;;
    pushd|pushd[[:space:]]*|popd|popd[[:space:]]*)
      # The directory stack is not tracked. A later tool has no known pin.
      explicit_cd=1
      dir_known=0
      return 0
      ;;
  esac
  shown=$(expose_executed "$raw")
  case "$(trim "$shown")" in
    "nvm use"|"nvm use "*)
      if [ "$op" = "&&" ] && [ "$dir_known" -eq 1 ]; then
        local picked
        picked=$(version_from_nvm_use "$(trim "$shown")")
        if [ "$picked" = "UNKNOWN" ]; then
          # --lts and other selectors do not promise the .nvmrc version.
          active=""
        elif [ "$picked" = "PIN" ]; then
          local fallback=0
          if [ "$explicit_cd" -eq 0 ]; then
            fallback=1
          fi
          active=$(pin_of "$search" "$fallback")
        else
          active=$picked
        fi
      fi
      ;;
  esac
  if has_tool "$shown"; then
    if printf '%s' "$shown" | grep -Eq '(^|[[:space:];|&|])(cd|pushd|popd)([[:space:]]|$)'; then
      blocked=1
      return 0
    fi
    local expect fallback=0
    if [ "$explicit_cd" -eq 0 ]; then
      fallback=1
    fi
    if [ "$dir_known" -eq 0 ]; then
      blocked=1
      return 0
    fi
    expect=$(pin_of "$search" "$fallback")
    if [ -z "$expect" ] || [ "$active" != "$expect" ]; then
      blocked=1
    fi
  fi
}

s=$command
i=0
n=${#s}
while [ "$i" -lt "$n" ]; do
  c=${s:i:1}
  if [ -n "${q:-}" ]; then
    seg="$seg$c"
    if [ "$q" = '"' ] && [ "$c" = '\' ]; then
      i=$((i + 1))
      if [ "$i" -lt "$n" ]; then
        seg="$seg${s:i:1}"
      fi
      i=$((i + 1))
      continue
    fi
    if [ "$c" = "$q" ]; then
      q=""
    fi
    i=$((i + 1))
    continue
  fi
  if [ "$c" = '\' ] && [ $((i + 1)) -lt "$n" ] && [ "${s:i+1:1}" = $'\n' ]; then
    seg="$seg "
    i=$((i + 2))
    continue
  fi
  if [ "$c" = "'" ] || [ "$c" = '"' ]; then
    q=$c
    seg="$seg$c"
    i=$((i + 1))
    continue
  fi
  two=${s:i:2}
  if [ "$two" = "&&" ] || [ "$two" = "||" ]; then
    consider_segment "$two"
    i=$((i + 2))
    continue
  fi
  if [ "$c" = ";" ] || [ "$c" = "|" ] || [ "$c" = $'\n' ]; then
    consider_segment "$c"
    i=$((i + 1))
    continue
  fi
  seg="$seg$c"
  i=$((i + 1))
done
consider_segment "end"

if [ "$blocked" -eq 1 ]; then
  printf '%s\n' '{"permission":"deny","agent_message":"Active node does not match the .nvmrc where the tool runs. Run nvm use && before npm, npx, pnpm, or node. A leading cd is fine when that directory uses the same pin."}'
  exit 0
fi

printf '%s\n' '{"permission":"allow"}'

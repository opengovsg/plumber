#!/usr/bin/env bash
# Runs the rewritten prefix from a directory that has no .nvmrc.
set -euo pipefail

root=$(CDPATH= cd "$(dirname "$0")/../.." && pwd)
filter="$root/.claude/hooks/bash-hook-for-nvm.jq"
failures=0

rewrite() {
  local command=$1
  jq -c -f "$filter" <<EOF
{"tool_input":{"command":$(jq -Rn --arg c "$command" '$c')}}
EOF
}

expect_empty() {
  local command=$1
  local out
  out=$(rewrite "$command")
  if [ -n "$out" ]; then
    printf 'FAIL expected no rewrite for: %s\n%s\n' "$command" "$out" >&2
    failures=$((failures + 1))
  fi
}

expect_version() {
  local dir=$1
  local command=$2
  local out rewritten
  out=$(rewrite "$command")
  rewritten=$(printf '%s' "$out" | jq -r '.hookSpecificOutput.updatedInput.command')
  if [ -z "$rewritten" ] || [ "$rewritten" = null ]; then
    printf 'FAIL missing rewrite for: %s\n' "$command" >&2
    failures=$((failures + 1))
    return
  fi
  local got
  got=$(cd "$dir" && bash -c "$rewritten")
  local want
  want=$(tr -d '[:space:]' < "$root/.nvmrc")
  case "$got" in
    *"$want"*) ;;
    *)
      printf 'FAIL in %s want version %s got %s\n' "$dir" "$want" "$got" >&2
      failures=$((failures + 1))
      ;;
  esac
}

expect_empty "echo hello"
expect_empty "cat pnpm-lock.yaml"
expect_empty "ls node_modules"
expect_fail() {
  local dir=$1
  local command=$2
  local out rewritten status
  out=$(rewrite "$command")
  rewritten=$(printf '%s' "$out" | jq -r '.hookSpecificOutput.updatedInput.command')
  status=0
  (cd "$dir" && bash -c "$rewritten") >/dev/null 2>&1 || status=$?
  if [ "$status" -eq 0 ]; then
    printf 'FAIL expected the pinned Node in %s to stop the command\n' "$dir" >&2
    failures=$((failures + 1))
  fi
}

expect_version "$root" "node -v"
expect_version /agent "node -v"
expect_fail "$root/packages/e2e" "node -v"

if [ "$failures" -ne 0 ]; then
  printf '%s failure(s)\n' "$failures" >&2
  exit 1
fi

printf 'ok\n'

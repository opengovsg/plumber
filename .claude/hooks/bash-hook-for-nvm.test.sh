#!/usr/bin/env bash
# The rewrite must select a pin without this machine's checkout layout.
set -euo pipefail

root=$(CDPATH= cd "$(dirname "$0")/../.." && pwd)
filter="$root/.claude/hooks/bash-hook-for-nvm.jq"
failures=0

bin=$(mktemp -d)
state=$(mktemp)
export NVM_STUB_STATE=$state
cat >"$bin/nvm" <<'EOF'
#!/bin/sh
if [ "$1" = "use" ]; then
  case "$2" in
    v1.2.3|1.2.3)
      printf '%s\n' "v1.2.3" >"$NVM_STUB_STATE"
      ;;
    *)
      printf '%s\n' "not installed" >&2
      exit 1
      ;;
  esac
  exit 0
fi
exit 0
EOF
cat >"$bin/node" <<'EOF'
#!/bin/sh
if [ -s "$NVM_STUB_STATE" ]; then
  cat "$NVM_STUB_STATE"
else
  printf '%s\n' "v0.0.0"
fi
EOF
chmod 755 "$bin/nvm" "$bin/node"
export PATH="$bin:/usr/bin:/bin"

fixture=$(mktemp -d)
mkdir -p "$fixture/repos/checkout/packages/other"
printf '%s\n' "v1.2.3" >"$fixture/repos/checkout/.nvmrc"
printf '%s\n' "v9.9.9" >"$fixture/repos/checkout/packages/other/.nvmrc"
project=$(mktemp -d)
printf '%s\n' "v1.2.3" >"$project/.nvmrc"
outside=$(mktemp -d)

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

run_rewritten() {
  local dir=$1
  local command=$2
  local out rewritten
  : >"$state"
  out=$(rewrite "$command")
  rewritten=$(printf '%s' "$out" | jq -r '.hookSpecificOutput.updatedInput.command')
  if [ -z "$rewritten" ] || [ "$rewritten" = null ]; then
    printf 'FAIL missing rewrite for: %s\n' "$command" >&2
    failures=$((failures + 1))
    return 1
  fi
  (
    cd "$dir"
    bash -c "$rewritten"
  )
}

expect_version() {
  local dir=$1
  local command=$2
  local want=$3
  local got status=0
  got=$(run_rewritten "$dir" "$command") || status=$?
  if [ "$status" -ne 0 ] || [ "$got" != "$want" ]; then
    printf 'FAIL in %s want %s got %s status %s\n' "$dir" "$want" "$got" "$status" >&2
    failures=$((failures + 1))
  fi
}

expect_fail() {
  local dir=$1
  local command=$2
  local status=0
  run_rewritten "$dir" "$command" >/dev/null 2>&1 || status=$?
  if [ "$status" -eq 0 ]; then
    printf 'FAIL expected %s to stop in %s\n' "$command" "$dir" >&2
    failures=$((failures + 1))
  fi
}

expect_empty "echo hello"
expect_empty "cat pnpm-lock.yaml"
expect_empty "ls node_modules"
expect_version "$fixture/repos/checkout" "node -v" "v1.2.3"
expect_version "$fixture" "node -v" "v1.2.3"
CLAUDE_PROJECT_DIR=$project expect_version "$outside" "node -v" "v1.2.3"
expect_fail "$fixture/repos/checkout/packages/other" "node -v"

rm -rf "$bin" "$fixture" "$project" "$outside" "$state"

if [ "$failures" -ne 0 ]; then
  printf '%s failure(s)\n' "$failures" >&2
  exit 1
fi

printf 'ok\n'

#!/usr/bin/env bash
# Locks the shell-hook contract for cloud `cd` prefixes and filename false positives.
set -euo pipefail

root=$(CDPATH= cd "$(dirname "$0")/../.." && pwd)
hook="$root/.cursor/hooks/require-nvm.sh"
failures=0

normalize() {
  printf '%s' "$1" | tr -d '[:space:]' | sed 's/^v//'
}

root_version=$(normalize "$(cat "$root/.nvmrc")")
e2e_version=$(normalize "$(cat "$root/packages/e2e/.nvmrc")")

stub_node() {
  local version=$1
  local dir
  dir=$(mktemp -d)
  cat >"$dir/node" <<EOF
#!/bin/sh
printf '%s\n' "v${version}"
EOF
  chmod 755 "$dir/node"
  printf '%s' "$dir"
}

assert_decision() {
  local path_dir=$1
  local cwd=$2
  local command=$3
  local want=$4
  local got json
  json=$(jq -n --arg command "$command" --arg cwd "$cwd" '{command:$command,cwd:$cwd}')
  got=$(printf '%s' "$json" | PATH="${path_dir}:/usr/bin:/bin" bash "$hook")
  local actual
  actual=$(printf '%s' "$got" | jq -r '.permission')
  if [ "$actual" != "$want" ]; then
    printf 'FAIL want %s got %s for: %s\n' "$want" "$actual" "$command" >&2
    printf '  output: %s\n' "$got" >&2
    failures=$((failures + 1))
  fi
}

match_dir=$(stub_node "$root_version")
miss_dir=$(stub_node "0.0.1")
e2e_dir=$(stub_node "$e2e_version")

assert_decision "$miss_dir" "$root" "echo hello" allow
assert_decision "$miss_dir" "$root" "cat .npmrc" allow
assert_decision "$miss_dir" "$root" "cat pnpm-lock.yaml" allow
assert_decision "$miss_dir" "$root" "ls node_modules" allow
assert_decision "$miss_dir" "$root" "ls versions/node/v1/bin" allow
assert_decision "$miss_dir" "$root" "echo renderer.node" allow
assert_decision "$miss_dir" "$root" "nvm use && pnpm -v" allow
assert_decision "$miss_dir" "$root" "cd '$root' && nvm use && pnpm -v" allow
assert_decision "$miss_dir" "$root" "cd '$root' || exit \$?; nvm use && pnpm install" allow
assert_decision "$miss_dir" "$root" "nvm use --silent && node -v" allow
assert_decision "$miss_dir" "$root" ". \"\$HOME/.nvm/nvm.sh\" && nvm use && pnpm install" allow
assert_decision "$miss_dir" "$root" "pnpm -v" deny
assert_decision "$miss_dir" "$root" "cd '$root' && pnpm -v" deny
assert_decision "$miss_dir" "$root" "npm install && nvm use" deny
assert_decision "$miss_dir" "$root" "pnpm install && nvm use" deny
assert_decision "$miss_dir" "$root" "nvm use || pnpm -v" deny
assert_decision "$miss_dir" "$root" "node script.js" deny
assert_decision "$match_dir" "$root" "pnpm -v" allow
assert_decision "$match_dir" "$root" "cd '$root' && pnpm install" allow
assert_decision "$miss_dir" "$root/packages/e2e" "pnpm test" deny
assert_decision "$e2e_dir" "$root/packages/e2e" "pnpm test" allow
assert_decision "$match_dir" "$root/packages/e2e" "pnpm test" deny
assert_decision "$match_dir" "$root/packages/e2e" "nvm use && pnpm test" allow

rm -rf "$match_dir" "$miss_dir" "$e2e_dir"

if [ "$failures" -ne 0 ]; then
  printf '%s failure(s)\n' "$failures" >&2
  exit 1
fi

printf 'ok\n'

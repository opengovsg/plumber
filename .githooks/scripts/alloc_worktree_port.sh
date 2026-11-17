#!/usr/bin/env bash
#
# NOTE: based on https://github.com/superset-sh/superset/pull/1494.
#
# Prints this worktree's port base, allocating one from a registry shared
# across Plumber worktrees if needed.
#
# Allocating prunes entries whose worktree directory is gone, because git has no
# hook for `git worktree remove`.
set -euo pipefail

# Teammates with other projects in the 13000 range can relocate Plumber's by
# exporting this in their shell profile.
START="${PLUMBER_WORKTREE_PORT_BASE:-13000}"
STRIDE=10
LOCK_TIMEOUT=30
LOCK_STALE=300

# The git common dir is shared by every worktree and never committed.
git_dir="$(git rev-parse --git-common-dir 2>/dev/null)" || {
  echo "alloc_worktree_port.sh: run inside the git repo" >&2
  exit 1
}
GIT_COMMON="$(cd "$git_dir" && pwd)"
REG="$GIT_COMMON/plumber-port-registry"
LOCK_DIR="$GIT_COMMON/plumber-port-registry.lock"

acquire_lock() {
  local waited=0 pid mtime
  while ! mkdir "$LOCK_DIR" 2>/dev/null; do
    pid=""
    [ -f "$LOCK_DIR/pid" ] && pid="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
    if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then
      rm -rf "$LOCK_DIR" 2>/dev/null || true # dead holder -> reclaim
      continue
    fi
    mtime="$(stat -f %m "$LOCK_DIR" 2>/dev/null || stat -c %Y "$LOCK_DIR" 2>/dev/null || true)"
    if [ -n "$mtime" ] && [ "$(($(date +%s) - mtime))" -ge "$LOCK_STALE" ]; then
      rm -rf "$LOCK_DIR" 2>/dev/null || true # stale -> reclaim
      continue
    fi
    if [ "$waited" -ge "$LOCK_TIMEOUT" ]; then
      echo "alloc_worktree_port.sh: timed out waiting for lock: $LOCK_DIR" >&2
      return 1
    fi
    sleep 1
    waited=$((waited + 1))
  done
  printf '%s\n' "$$" > "$LOCK_DIR/pid" 2>/dev/null || true
}

unlock() { rm -rf "$LOCK_DIR" 2>/dev/null || true; }

ensure_reg() {
  mkdir -p "$(dirname "$REG")"
  [ -f "$REG" ] || : > "$REG"
}

lookup_base() { # print existing base for $PWD, else nothing
  local b p
  while IFS="$(printf '\t')" read -r b p; do
    if [ "$p" = "$PWD" ]; then
      printf '%s' "$b"
      return 0
    fi
  done < "$REG"
  return 0
}

prune_dead() { # best-effort: drop registry entries whose worktree dir is gone
  local tmp b p pruned=0
  tmp="${REG}.prune.$$"
  while IFS="$(printf '\t')" read -r b p; do
    if [ -n "$p" ] && [ -d "$p" ]; then
      printf '%s\t%s\n' "$b" "$p"
    elif [ -n "$p" ]; then
      pruned=$((pruned + 1))
    fi
  done < "$REG" > "$tmp" || { rm -f "$tmp"; return 0; }
  if [ "$pruned" -gt 0 ] && mv "$tmp" "$REG"; then
    echo "alloc_worktree_port.sh: pruned $pruned stale registry entries" >&2
  else
    rm -f "$tmp"
  fi
  return 0
}

ensure_reg
acquire_lock || exit 1
trap unlock EXIT

# Safe: $PWD always exists, so this worktree is never pruned.
prune_dead

base="$(lookup_base)"
if [ -z "$base" ]; then
  used="$(cut -f1 "$REG")"
  base=$START
  while printf '%s\n' "$used" | grep -qx "$base"; do
    base=$((base + STRIDE))
  done
  printf '%s\t%s\n' "$base" "$PWD" >> "$REG"
fi

unlock
trap - EXIT

printf '%s\n' "$base"

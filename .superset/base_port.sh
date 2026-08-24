#!/usr/bin/env bash
#
# NOTE: based on https://github.com/superset-sh/superset/pull/1494.
#
# Assign this worktree a port base from a project-local registry shared across
# Plumber worktrees (via $SUPERSET_ROOT_PATH) and print the port base.
#   bash base_port.sh            -> print the port base (allocating if needed)
#   bash base_port.sh --release  -> remove this worktree's ($PWD) allocation
#
# Allocating also prunes entries whose worktree directory is gone, so bases
# from worktrees deleted outside Superset (which never ran --release) are reused.
#
# Only runs under Superset (needs SUPERSET_ROOT_PATH). A plain `pnpm run dev`
# never calls this and falls back to 3000/3001 in vite.config.ts / package.json.
set -euo pipefail

# Base port for this project's worktrees. Teammates who run other Superset
# projects in the 13000 range can relocate Plumber's by exporting this (e.g. via
# a .superset/config.local.json `run.before`, or their shell profile).
START="${PLUMBER_SUPERSET_PORT_BASE:-13000}"
STRIDE=10
LOCK_TIMEOUT=30
LOCK_STALE=300

if [ -z "${SUPERSET_ROOT_PATH:-}" ]; then
  echo "base_port.sh: SUPERSET_ROOT_PATH is not set (run under Superset)" >&2
  exit 1
fi
REG="$SUPERSET_ROOT_PATH/.superset/port-registry"
LOCK_DIR="$SUPERSET_ROOT_PATH/.superset/port-registry.lock"

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
      echo "base_port.sh: timed out waiting for lock: $LOCK_DIR" >&2
      return 1
    fi
    sleep 1
    waited=$((waited + 1))
  done
  printf '%s\n' "$$" > "$LOCK_DIR/pid" 2>/dev/null || true
}

release_lock() { rm -rf "$LOCK_DIR" 2>/dev/null || true; }

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
    echo "base_port.sh: pruned $pruned stale registry entries (worktree deleted outside Superset)" >&2
  else
    rm -f "$tmp"
  fi
  return 0
}

if [ "${1:-}" = "--release" ]; then
  ensure_reg
  acquire_lock || exit 1
  trap release_lock EXIT
  tmp="${REG}.tmp.$$"
  if awk -F'\t' -v k="$PWD" '$2 != k' "$REG" > "$tmp" && mv "$tmp" "$REG"; then
    echo "base_port.sh: released allocation for $PWD" >&2
  else
    rm -f "$tmp"
    echo "base_port.sh: failed to release allocation" >&2
    exit 1
  fi
  exit 0
fi

ensure_reg
acquire_lock || exit 1
trap release_lock EXIT

# Reclaim bases from worktrees deleted outside Superset (they never ran
# --release). Safe: $PWD always exists, so this worktree is never pruned.
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

release_lock
trap - EXIT

printf '%s\n' "$base"

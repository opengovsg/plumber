#!/usr/bin/env bash
# Assign this Superset worktree's ports, then start the dev servers.
# Wired up via .superset/config.json: "run": ["bash .superset/run.sh"].
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
base="$(bash "$SCRIPT_DIR/base_port.sh")" # set -e propagates base_port.sh failure
export PORT="$base"
export BASE_URL="http://localhost:$base"
export WEB_APP_URL="http://localhost:$((base + 1))"
export DEV_BACKEND_PORT="$base"
export DEV_FRONTEND_PORT="$((base + 1))"
exec npm run dev

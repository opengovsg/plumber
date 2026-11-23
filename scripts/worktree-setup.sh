#!/usr/bin/env bash
# Prepares a new worktree so an agent can run `pnpm run dev:sample-env` without 1Password.
# Orca runs this as the repo's setup script.
set -euo pipefail

cd "$(dirname "$0")/.."

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck source=/dev/null
. "$NVM_DIR/nvm.sh"
nvm install

pnpm install

if ! docker info >/dev/null 2>&1; then
  echo "worktree-setup: Docker is not running. Skipped dev services and migrations." >&2
  echo "worktree-setup: Start Docker, then re-run scripts/worktree-setup.sh." >&2
  exit 0
fi

# The tunnel service needs CLOUDFLARE_TOKEN from 1Password, so it is left out.
# All worktrees share these containers, since the compose project name comes from packages/backend.
compose=(docker compose -f packages/backend/docker-compose.dev.yml)
"${compose[@]}" up -d postgres tiles-postgres redis minio create-minio-buckets dynamodb
"${compose[@]}" up -d --wait postgres tiles-postgres

# `pnpm run migrate` prompts for a target database. Bare knex only reaches the .env-example database.
pnpm --filter backend exec knex migrate:latest

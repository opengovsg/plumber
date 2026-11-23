#!/usr/bin/env bash
# Prepares a new worktree so an agent can run `pnpm run dev:sample-env` without 1Password.
# It starts shared Docker services, so a worktree tool runs it only when the user opts in.
set -euo pipefail

cd "$(dirname "$0")/.."

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  nvm install
fi
want=$(tr -d '[:space:]' < .nvmrc)
have=$(node -v 2>/dev/null || true)
if [ "${have#v}" != "${want#v}" ]; then
  echo "worktree-setup: needs Node $want from .nvmrc, found ${have:-none}." >&2
  exit 1
fi

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

# `pnpm run migrate` prompts for a target database. An empty env limits knex to the .env-example placeholders.
# IMPORTANT: worktrees share one database, so a branch-only migration makes knex reject older worktrees.
env -i PATH="$PATH" HOME="$HOME" pnpm --filter backend exec knex migrate:latest

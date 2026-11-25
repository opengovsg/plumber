/**
 * Starts the shared Docker dev services and migrates the local database.
 *
 * Runs before `dev:sample-env`, so Docker starts only when someone runs the app.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { fail, readShellEnv } from './dev-env-utils.mjs'

const repoRoot = path.join(import.meta.dirname, '..')
const backendDir = path.join(repoRoot, 'packages/backend')
// The tunnel service needs CLOUDFLARE_TOKEN from 1Password, so it is left out.
const SERVICES = [
  'postgres',
  'tiles-postgres',
  'redis',
  'minio',
  'create-minio-buckets',
  'dynamodb',
]

function runStep(command, args, options = {}) {
  // Output goes to stderr, so callers that parse stdout only see their own lines.
  const result = spawnSync(command, args, {
    stdio: ['ignore', 2, 2],
    ...options,
  })
  if (result.error) {
    fail(`cannot run ${command}. ${result.error.message}`)
  }
  return result.status === 0
}

if (!existsSync(path.join(repoRoot, 'node_modules'))) {
  fail('dependencies are missing. Run `pnpm install` first.')
}

if (!runStep('docker', ['info'], { stdio: 'ignore' })) {
  fail('Docker is not running. Start Docker, then try again.')
}

// All worktrees share these containers, since the compose project name comes from packages/backend.
const compose = [
  'compose',
  '-f',
  path.join(backendDir, 'docker-compose.dev.yml'),
]
if (
  !runStep('docker', [...compose, 'up', '-d', ...SERVICES]) ||
  !runStep('docker', [
    ...compose,
    'up',
    '-d',
    '--wait',
    'postgres',
    'tiles-postgres',
  ])
) {
  fail('could not start the dev services.')
}

// `pnpm run migrate` prompts for a target database. The shell allowlist limits knex to the .env-example placeholders.
// IMPORTANT: worktrees share one database, so a branch-only migration makes knex reject older worktrees.
const knexCli = createRequire(path.join(backendDir, 'package.json')).resolve(
  'knex/bin/cli.js',
)
if (
  !runStep(process.execPath, [knexCli, 'migrate:latest'], {
    cwd: backendDir,
    env: readShellEnv(),
  })
) {
  fail('migrations failed.')
}

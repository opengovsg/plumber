/**
 * Starts the shared Docker dev services and migrates the local database.
 *
 * Runs before `dev:sample-env`, so Docker starts only when someone runs the app.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

import {
  acquireLock,
  DEV_SERVICES_LOCK,
  fail,
  isPortInUse,
  readShellEnv,
} from './dev-env-utils.mjs'

const repoRoot = path.join(import.meta.dirname, '..')
const backendDir = path.join(repoRoot, 'packages/backend')
const backendRequire = createRequire(path.join(backendDir, 'package.json'))
const MIGRATION_LOCK_TIMEOUT_MS = 300_000
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

// IMPORTANT: compose would change containers on whatever daemon the shell points at, so refuse a remote one.
const context = spawnSync(
  'docker',
  ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'],
  { encoding: 'utf8' },
)
if (context.error) {
  fail(`cannot run docker. ${context.error.message}`)
}
const dockerHost = process.env.DOCKER_HOST || context.stdout.trim()
// A named pipe on another machine looks like //host/pipe, so only the local //./pipe form counts.
if (!/^(unix:\/\/|npipe:\/\/\/\/\.\/pipe\/)/.test(dockerHost)) {
  fail(
    `Docker points at ${dockerHost || 'an unknown host'}, not a local socket. Ask the user.`,
  )
}

if (!runStep('docker', ['info'], { stdio: 'ignore' })) {
  fail('Docker is not running. Start Docker, then try again.')
}

// Two cold starts would both initialise knex's migration tables, so only one start runs this at a time.
const lock = await acquireLock(DEV_SERVICES_LOCK, MIGRATION_LOCK_TIMEOUT_MS)

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
const knexCli = backendRequire.resolve('knex/bin/cli.js')
if (
  !runStep(process.execPath, [knexCli, 'migrate:latest'], {
    cwd: backendDir,
    env: readShellEnv(),
  })
) {
  fail('migrations failed.')
}

// DynamoDB Local can take longer than Postgres to accept requests after a cold start.
const dynamodbDeadline = Date.now() + 60_000
while (!(await isPortInUse(8000, '127.0.0.1'))) {
  if (Date.now() > dynamodbDeadline) {
    fail('DynamoDB Local did not start on port 8000.')
  }
  await sleep(1000)
}

// `pnpm run setup` creates the Tiles table in postsetup. The script skips an existing table.
if (
  !runStep(
    process.execPath,
    [
      backendRequire.resolve('ts-node/dist/bin.js'),
      'src/db/dynamodb_seeds/create_table.ts',
    ],
    { cwd: backendDir, env: readShellEnv() },
  )
) {
  fail('could not create the DynamoDB Tiles table.')
}

lock.close()

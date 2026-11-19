import { spawn } from 'node:child_process'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { connect, createServer } from 'node:net'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

/**
 * Runs a command with variables from a 1Password Environment injected.
 *
 * Keeps local dev secrets off disk. See README.md for the one-time setup.
 */
import { createClient, DesktopAuth } from '@1password/sdk'

const CONFIG_FILE = 'op-dev.json'
const EXAMPLE_FILE = 'op-dev.example.json'
const USAGE =
  'usage: node scripts/with-human-dev-env.mjs [--env <name>] <command> [args...]'

const repoRoot = path.join(import.meta.dirname, '..')
const configPath = path.join(repoRoot, CONFIG_FILE)

function fail(message) {
  console.error(`with-human-dev-env: ${message}`)
  process.exit(1)
}

function readConfig() {
  let raw
  try {
    raw = readFileSync(configPath, 'utf8')
  } catch {
    fail(
      `no ${CONFIG_FILE} at ${configPath}.\n` +
        `Copy ${EXAMPLE_FILE} to ${CONFIG_FILE}, then fill in your own account name and environment ids.\n` +
        'Each id comes from the 1Password app, under Developer > View Environments > View environment > Manage environment > Copy environment ID.',
    )
  }

  try {
    return JSON.parse(raw)
  } catch (error) {
    fail(`${CONFIG_FILE} is not valid JSON. ${error.message}`)
  }
}

function parseArgs(argv) {
  let envName = 'dev'
  let index = 0

  while (index < argv.length) {
    const arg = argv[index]
    if (arg === '--env') {
      envName = argv[index + 1]
      index += 2
      continue
    }
    if (arg.startsWith('--env=')) {
      envName = arg.slice('--env='.length)
      index += 1
      continue
    }
    break
  }

  if (!envName) {
    fail(`--env needs a name. ${USAGE}`)
  }

  return { envName, command: argv.slice(index) }
}

const WORKTREE_PORT_START =
  Number(process.env.PLUMBER_WORKTREE_PORT_BASE) || 13000
const WORKTREE_PORT_STRIDE = 10
// Ends at 29990/29991 for the default start, below Kubernetes' 30000-32767 service port range.
const WORKTREE_PORT_SLOTS = 1700

// The OS frees a listening port when its process dies, so a crash can't leave a stale lock.
const WORKTREE_PORT_LOCK = WORKTREE_PORT_START - 1
const WORKTREE_PORT_FILE = 'plumber-port'

// Connects instead of test-listening, because SO_REUSEADDR lets a test listen succeed on a held port.
function isPortInUse(port, host) {
  return new Promise((resolve) => {
    const socket = connect({ port, host })
    socket.setTimeout(1000)
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('timeout', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
  })
}

async function isPortPairFree(base) {
  const checks = [base, base + 1].flatMap((port) =>
    ['127.0.0.1', '::1'].map((host) => isPortInUse(port, host)),
  )
  return !(await Promise.all(checks)).some(Boolean)
}

/**
 * Finds this worktree's folder under the main checkout's .git/worktrees.
 *
 * IMPORTANT: `git worktree remove` deletes that folder, which frees the worktree's ports.
 */
function readWorktreeGitDir() {
  const dotGit = path.join(repoRoot, '.git')
  // A linked worktree's .git is a file. The main checkout's is a folder.
  if (!statSync(dotGit, { throwIfNoEntry: false })?.isFile()) {
    return undefined
  }
  const gitDir = readFileSync(dotGit, 'utf8').match(/^gitdir: (.+)$/m)?.[1]
  return gitDir && path.resolve(repoRoot, gitDir.trim())
}

function readPortFile(gitDir) {
  try {
    return (
      Number(readFileSync(path.join(gitDir, WORKTREE_PORT_FILE), 'utf8')) ||
      undefined
    )
  } catch {
    return undefined
  }
}

async function lockPortAllocation() {
  const deadline = Date.now() + 10_000
  for (;;) {
    const server = createServer()
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(WORKTREE_PORT_LOCK, '127.0.0.1', resolve)
      })
      return server
    } catch (error) {
      if (error.code !== 'EADDRINUSE' || Date.now() > deadline) {
        fail(`cannot lock port ${WORKTREE_PORT_LOCK}. ${error.message}`)
      }
      await sleep(100)
    }
  }
}

async function allocatePorts(gitDir) {
  const worktreesDir = path.dirname(gitDir)
  const claimed = new Set(
    readdirSync(worktreesDir).map((name) =>
      readPortFile(path.join(worktreesDir, name)),
    ),
  )

  for (let slot = 0; slot < WORKTREE_PORT_SLOTS; slot++) {
    const base = WORKTREE_PORT_START + slot * WORKTREE_PORT_STRIDE
    if (!claimed.has(base) && (await isPortPairFree(base))) {
      writeFileSync(path.join(gitDir, WORKTREE_PORT_FILE), `${base}\n`)
      return base
    }
  }

  fail(`no free worktree ports from ${WORKTREE_PORT_START}.`)
}

/**
 * Gives each linked worktree its own ports, so several worktrees can run the dev server at once.
 *
 * IMPORTANT: the main checkout keeps 3000/3001.
 */
async function getWorktreePorts() {
  const gitDir = readWorktreeGitDir()
  if (!gitDir) {
    return {}
  }

  let base = readPortFile(gitDir)
  if (!base) {
    const lock = await lockPortAllocation()
    try {
      // Another run in this worktree may have allocated while we waited for the lock.
      base = readPortFile(gitDir) ?? (await allocatePorts(gitDir))
    } finally {
      lock.close()
    }
  }

  return {
    PORT: String(base),
    BASE_URL: `http://localhost:${base}`,
    WEB_APP_URL: `http://localhost:${base + 1}`,
    DEV_BACKEND_PORT: String(base),
    DEV_FRONTEND_PORT: String(base + 1),
  }
}

async function createOpClient(accountName) {
  try {
    return await createClient({
      auth: new DesktopAuth(accountName),
      integrationName: 'Plumber local dev',
      integrationVersion: 'v1.0.0',
    })
  } catch (error) {
    fail(
      'could not connect to 1Password.\n' +
        'Check that:\n' +
        '  - the 1Password app is running and unlocked\n' +
        '  - Settings > Developer > Integrate with other apps is on\n' +
        `  - "accountName" in ${CONFIG_FILE} matches the account name in the app\n` +
        `${error.message}`,
    )
  }
}

async function fetchEnvironmentVariables(client, environmentId, label) {
  try {
    const { variables } = await client.environments.getVariables(environmentId)
    return Object.fromEntries(variables.map(({ name, value }) => [name, value]))
  } catch (error) {
    fail(
      `could not read the "${label}" 1Password environment.\n` +
        'Check that:\n' +
        '  - the 1Password app is running and unlocked\n' +
        '  - Settings > Developer > Integrate with other apps is on\n' +
        `  - the "${label}" environment id in ${CONFIG_FILE} is current\n` +
        `${error.message}`,
    )
  }
}

function readInheritedEnvironmentIds(config) {
  const { inheritedEnvironments } = config

  if (inheritedEnvironments === undefined) {
    return []
  }
  if (
    !Array.isArray(inheritedEnvironments) ||
    inheritedEnvironments.some((id) => typeof id !== 'string' || id === '')
  ) {
    fail(
      `${CONFIG_FILE}'s "inheritedEnvironments" must be an array of ` +
        'environment id strings, e.g. ["team environment 1", "team environment 2"].',
    )
  }

  return inheritedEnvironments
}

async function fetchVariables(envName) {
  const config = readConfig()
  const environmentId = config.environments?.[envName]

  if (!config.accountName) {
    fail(`${CONFIG_FILE} has no "accountName".`)
  }
  if (!environmentId) {
    fail(`${CONFIG_FILE} has no environment id for "${envName}".`)
  }

  const inheritedIds = readInheritedEnvironmentIds(config)
  const client = await createOpClient(config.accountName)

  // Inherited environments hold common team-level env vars, so they load
  // first: a developer's own "--env" environment overrides any of them.
  const variables = {}
  for (const inheritedId of inheritedIds) {
    Object.assign(
      variables,
      await fetchEnvironmentVariables(client, inheritedId, 'inherited'),
    )
  }
  Object.assign(
    variables,
    await fetchEnvironmentVariables(client, environmentId, envName),
  )

  return variables
}

function run(command, env) {
  // The package manager already split argv through sh -c, so a shell would re-parse quoted --exec values.
  const child = spawn(command[0], command.slice(1), {
    stdio: 'inherit',
    env,
    shell: false,
  })

  // turbo signals the loader rather than the child, so Ctrl-C must be relayed to reach nodemon.
  const relay = (signal) => child.kill(signal)
  process.on('SIGINT', relay)
  process.on('SIGTERM', relay)

  child.on('error', (error) =>
    fail(`cannot run ${command[0]}. ${error.message}`),
  )

  child.on('exit', (code, signal) => {
    if (signal) {
      process.removeListener('SIGINT', relay)
      process.removeListener('SIGTERM', relay)
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 1)
  })
}

async function main() {
  const { envName, command } = parseArgs(process.argv.slice(2))

  if (command.length === 0) {
    fail(USAGE)
  }

  const variables = await fetchVariables(envName)
  const ports = await getWorktreePorts()

  // Shell exports win, so harnesses can still pick their own ports.
  run(command, { ...variables, ...ports, ...process.env })
}

main()

import { spawn } from 'node:child_process'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { connect, createServer } from 'node:net'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const repoRoot = path.join(import.meta.dirname, '..')

export function fail(message) {
  console.error(`${path.basename(process.argv[1], '.mjs')}: ${message}`)
  process.exit(1)
}

// IMPORTANT: anything else from the shell, e.g. an exported RDS_PROXY_HOST, would override the .env-example placeholders.
const PASSTHROUGH_VARS = [
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TERM',
  'COLORTERM',
  'LANG',
  'LC_ALL',
  'TMPDIR',
  'NVM_DIR',
  'NVM_BIN',
  'NVM_INC',
  // Windows needs these to spawn processes and find the user's folders.
  'SYSTEMROOT',
  'COMSPEC',
  'PATHEXT',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'TEMP',
  'TMP',
]

export function readShellEnv() {
  return Object.fromEntries(
    PASSTHROUGH_VARS.filter((name) => process.env[name] !== undefined).map(
      (name) => [name, process.env[name]],
    ),
  )
}

const WORKTREE_PORT_START =
  Number(process.env.PLUMBER_WORKTREE_PORT_BASE) || 13000
const WORKTREE_PORT_STRIDE = 10
// Ends at 29990/29991 for the default start, below Kubernetes' 30000-32767 service port range.
const WORKTREE_PORT_SLOTS = 1700

// The OS frees a listening port when its process dies, so a crash can't leave a stale lock.
const WORKTREE_PORT_LOCK = WORKTREE_PORT_START - 1
const WORKTREE_PORT_FILE = 'plumber-port'
// IMPORTANT: fixed, not derived from PLUMBER_WORKTREE_PORT_BASE, because every shell migrates the same database.
export const DEV_SERVICES_LOCK = 12998

// Connects instead of test-listening, because SO_REUSEADDR lets a test listen succeed on a held port.
export function isPortInUse(port, host) {
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

// Holds a machine-wide lock by listening on a loopback port.
export async function acquireLock(port, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const server = createServer()
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, '127.0.0.1', resolve)
      })
      return server
    } catch (error) {
      if (error.code !== 'EADDRINUSE' || Date.now() > deadline) {
        fail(`cannot lock port ${port}. ${error.message}`)
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
export async function getWorktreePorts() {
  const gitDir = readWorktreeGitDir()
  if (!gitDir) {
    return {}
  }

  let base = readPortFile(gitDir)
  if (!base) {
    const lock = await acquireLock(WORKTREE_PORT_LOCK)
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

export function run(command, env) {
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

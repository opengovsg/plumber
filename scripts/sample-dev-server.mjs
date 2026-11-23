/**
 * Starts, checks and stops this worktree's `dev:sample-env` server for agents.
 *
 * Each command works from a fresh shell, so agents need not keep PIDs or log paths between tool calls.
 */
import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { stripVTControlCharacters } from 'node:util'

import { fail, getWorktreePorts, isPortInUse } from './dev-env-utils.mjs'

const repoRoot = path.join(import.meta.dirname, '..')
const tmpDir = path.join(repoRoot, 'tmp')
const logPath = path.join(tmpDir, 'plumber-dev.log')
const statePath = path.join(tmpDir, 'sample-dev-server.json')
const READY_TIMEOUT_MS = 180_000
const STOP_TIMEOUT_MS = 20_000
const USAGE =
  'usage: node scripts/sample-dev-server.mjs start | status | stop | email | otp <email>'

// Agents parse these lines from stdout.
function out(line) {
  // oxlint-disable-next-line no-console
  console.log(line)
}

function readLog() {
  return existsSync(logPath)
    ? stripVTControlCharacters(readFileSync(logPath, 'utf8'))
    : ''
}

async function isPortTaken(port) {
  const results = await Promise.all(
    ['127.0.0.1', '::1'].map((host) => isPortInUse(port, host)),
  )
  return results.some(Boolean)
}

// A start time plus command line pins the process, so a recycled PID never matches.
function describeProcess(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return undefined
  }
  // A fixed zone and locale keep lstart stable across shells. -ww stops truncation.
  const result = spawnSync(
    'ps',
    ['-ww', '-o', 'lstart=,command=', '-p', String(pid)],
    { encoding: 'utf8', env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' } },
  )
  if (result.error || result.stderr.trim()) {
    fail(
      `cannot inspect processes with ps. ${result.error?.message ?? result.stderr.trim()}`,
    )
  }
  return result.stdout.trim() || undefined
}

function readOwnedServer() {
  if (!existsSync(statePath)) {
    return undefined
  }
  const state = JSON.parse(readFileSync(statePath, 'utf8'))
  if (state.process && describeProcess(state.pid) === state.process) {
    return state
  }
  // The recorded server is gone, so its state file is stale.
  rmSync(statePath)
  return undefined
}

function isReady({ backendPort, frontendPort }) {
  // The log is truncated on start, so these lines can only come from this run.
  const log = readLog()
  return (
    log.includes(`Server is listening on ${backendPort}`) &&
    log.includes(`Local:   http://localhost:${frontendPort}/`)
  )
}

async function waitUntilReady(state) {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (isReady(state)) {
      return true
    }
    if (!readOwnedServer()) {
      fail(`the server exited during start. See ${logPath}.`)
    }
    await sleep(1000)
  }
  return false
}

function printUrls({ backendPort, frontendPort }) {
  out(`backend http://localhost:${backendPort}`)
  out(`frontend http://localhost:${frontendPort}`)
}

async function getLinkedWorktreePorts() {
  const ports = await getWorktreePorts()
  if (!ports.DEV_BACKEND_PORT) {
    fail(
      'this is the main checkout. Its ports belong to the human dev server. Use a linked worktree.',
    )
  }
  return {
    backendPort: Number(ports.DEV_BACKEND_PORT),
    frontendPort: Number(ports.DEV_FRONTEND_PORT),
  }
}

async function start() {
  const running = readOwnedServer()
  if (running) {
    if (!(await waitUntilReady(running))) {
      fail(`the running server is not ready. See ${logPath}.`)
    }
    out('already running')
    printUrls(running)
    return
  }

  const ports = await getLinkedWorktreePorts()
  for (const port of [ports.backendPort, ports.frontendPort]) {
    if (await isPortTaken(port)) {
      fail(
        `port ${port} is in use by a process this script did not start. Ask the user before stopping it.`,
      )
    }
  }

  mkdirSync(tmpDir, { recursive: true })
  const logFd = openSync(logPath, 'w')
  const child = spawn(
    process.execPath,
    [
      'scripts/with-sample-env.mjs',
      process.execPath,
      'node_modules/turbo/bin/turbo',
      'watch',
      'dev',
      'worker',
      '--continue',
    ],
    { cwd: repoRoot, detached: true, stdio: ['ignore', logFd, logFd] },
  )
  closeSync(logFd)
  child.unref()

  const state = {
    pid: child.pid,
    process: describeProcess(child.pid),
    ...ports,
  }
  try {
    if (!state.process) {
      throw new Error('could not record the server process.')
    }
    // The exclusive create makes a concurrent start lose instead of overwriting this record.
    writeFileSync(statePath, `${JSON.stringify(state)}\n`, { flag: 'wx' })
  } catch (error) {
    if (child.pid) {
      process.kill(-child.pid, 'SIGTERM')
    }
    fail(
      error.code === 'EEXIST'
        ? 'another start is in progress in this worktree.'
        : error.message,
    )
  }

  if (!(await waitUntilReady(state))) {
    await stop()
    fail(
      `the server was not ready after ${READY_TIMEOUT_MS / 1000}s. See ${logPath}.`,
    )
  }
  printUrls(ports)
}

function status() {
  const running = readOwnedServer()
  if (!running) {
    out('not running')
    return
  }
  out(isReady(running) ? 'running' : 'starting')
  printUrls(running)
}

async function waitFor(check, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await check()) {
      return true
    }
    await sleep(500)
  }
  return false
}

async function stop() {
  const running = readOwnedServer()
  if (!running) {
    out('not running')
    return
  }

  // with-sample-env relays SIGTERM, so turbo shuts its tasks down cleanly.
  process.kill(running.pid, 'SIGTERM')
  const isGone = () => describeProcess(running.pid) !== running.process
  if (!(await waitFor(isGone, STOP_TIMEOUT_MS))) {
    process.kill(-running.pid, 'SIGKILL')
  }

  // IMPORTANT: turbo runs each task in its own process group, so a SIGKILL above can miss them.
  const portsFree = async () =>
    !(await isPortTaken(running.backendPort)) &&
    !(await isPortTaken(running.frontendPort))
  if (!(await waitFor(portsFree, STOP_TIMEOUT_MS))) {
    fail(
      `ports ${running.backendPort} and ${running.frontendPort} are still in use after stopping. Ask the user.`,
    )
  }
  rmSync(statePath, { force: true })
  out('stopped')
}

function email() {
  out(`agent-${randomBytes(6).toString('hex')}@open.gov.sg`)
}

async function otp(address) {
  if (!address) {
    fail(USAGE)
  }
  // The backend prints the OTP about 100 ms after the request.
  const prefix = `OTP for ${address}: `
  for (let attempt = 0; attempt < 10; attempt++) {
    const line = readLog()
      .split('\n')
      .findLast((text) => text.includes(prefix))
    if (line) {
      out(line.slice(line.indexOf(prefix) + prefix.length).trim())
      return
    }
    await sleep(500)
  }
  fail(`no OTP for ${address} in ${logPath}. Request one first.`)
}

const [command, arg] = process.argv.slice(2)
const commands = { start, status, stop, email, otp: () => otp(arg) }
if (!commands[command]) {
  fail(USAGE)
}
await commands[command]()

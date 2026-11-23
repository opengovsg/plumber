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
    throw new Error(
      `cannot inspect processes with ps. ${result.error?.message ?? result.stderr.trim()}`,
    )
  }
  return result.stdout.trim() || undefined
}

function readState() {
  return existsSync(statePath)
    ? JSON.parse(readFileSync(statePath, 'utf8'))
    : undefined
}

function writeState(state, flag = 'w') {
  writeFileSync(statePath, `${JSON.stringify(state)}\n`, { flag })
}

// Drops the state file only if it still belongs to this run.
function clearState(runId) {
  if (readState()?.runId === runId) {
    rmSync(statePath, { force: true })
  }
}

// The markers prove this run booted. The live ports catch a backend that crashed after a later edit.
async function isReady({ backendPort, frontendPort }) {
  // The log is truncated on start, so these lines can only come from this run.
  const log = readLog()
  return (
    log.includes(`Server is listening on ${backendPort}`) &&
    log.includes(`Local:   http://localhost:${frontendPort}/`) &&
    (await isPortTaken(backendPort)) &&
    (await isPortTaken(frontendPort))
  )
}

async function arePortsBusy({ backendPort, frontendPort }) {
  return (await isPortTaken(backendPort)) || (await isPortTaken(frontendPort))
}

/**
 * Reads the worktree's server state and drops records whose processes are gone.
 *
 * IMPORTANT: a failed stop keeps its record while the ports stay busy, so no command reports the server gone too early.
 */
async function classify() {
  const state = readState()
  if (!state) {
    return { phase: 'none' }
  }
  if (state.stopFailed) {
    if (await arePortsBusy(state)) {
      return { phase: 'stop-incomplete', state }
    }
  } else if (state.pid) {
    if (describeProcess(state.pid) === state.process) {
      return { phase: (await isReady(state)) ? 'running' : 'starting', state }
    }
  } else if (describeProcess(state.claimant) === state.claimantProcess) {
    return { phase: 'claimed', state }
  }
  clearState(state.runId)
  return { phase: 'none' }
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

// Waits for the run that owns the state file to become ready.
async function waitForRun(runId) {
  return waitFor(async () => {
    const { phase, state } = await classify()
    if (
      state?.runId !== runId ||
      !['claimed', 'starting', 'running'].includes(phase)
    ) {
      throw new Error(`the server exited during start. See ${logPath}.`)
    }
    return phase === 'running'
  }, READY_TIMEOUT_MS)
}

async function start() {
  // Fails before anything launches when this shell cannot inspect processes.
  describeProcess(process.pid)

  const current = await classify()
  if (current.phase === 'stop-incomplete') {
    fail('a previous stop left the ports in use. Ask the user.')
  }
  if (current.phase !== 'none') {
    if (!(await waitForRun(current.state.runId))) {
      fail(`the running server is not ready. See ${logPath}.`)
    }
    out('already running')
    printUrls(current.state)
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

  // Claim the worktree before touching the log, so a concurrent start cannot clobber this run.
  mkdirSync(tmpDir, { recursive: true })
  const runId = randomBytes(8).toString('hex')
  const claim = {
    runId,
    claimant: process.pid,
    claimantProcess: describeProcess(process.pid),
    ...ports,
  }
  try {
    writeState(claim, 'wx')
  } catch (error) {
    fail(
      error.code === 'EEXIST'
        ? 'another start is in progress in this worktree.'
        : error.message,
    )
  }

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

  try {
    const signature = describeProcess(child.pid)
    if (!signature) {
      throw new Error('could not record the server process.')
    }
    writeState({ ...claim, pid: child.pid, process: signature })
  } catch (error) {
    if (child.pid) {
      process.kill(-child.pid, 'SIGTERM')
    }
    clearState(runId)
    fail(error.message)
  }

  if (!(await waitForRun(runId))) {
    await stopRun(runId)
    fail(
      `the server was not ready after ${READY_TIMEOUT_MS / 1000}s. See ${logPath}.`,
    )
  }
  printUrls(ports)
}

async function status() {
  const { phase, state } = await classify()
  const labels = {
    none: 'not running',
    claimed: 'not ready',
    starting: 'not ready',
    running: 'running',
    'stop-incomplete': 'stop incomplete, ports still in use',
  }
  out(labels[phase])
  if (state) {
    printUrls(state)
  }
}

// Stops one run, so a timed-out start never touches a newer server.
async function stopRun(runId) {
  const { phase, state } = await classify()
  if (state?.runId !== runId) {
    return
  }
  if (phase === 'claimed') {
    fail('a start is in progress. Run stop again once it finishes.')
  }

  if (phase === 'starting' || phase === 'running') {
    // with-sample-env relays SIGTERM, so turbo shuts its tasks down cleanly.
    process.kill(state.pid, 'SIGTERM')
    const isGone = () => describeProcess(state.pid) !== state.process
    if (!(await waitFor(isGone, STOP_TIMEOUT_MS))) {
      process.kill(-state.pid, 'SIGKILL')
    }
  }

  // IMPORTANT: turbo runs each task in its own process group, so a SIGKILL above can miss them.
  if (
    !(await waitFor(async () => !(await arePortsBusy(state)), STOP_TIMEOUT_MS))
  ) {
    writeState({ ...state, stopFailed: true })
    fail(
      `ports ${state.backendPort} and ${state.frontendPort} are still in use after stopping. Ask the user.`,
    )
  }
  clearState(runId)
}

async function stop() {
  const { phase, state } = await classify()
  if (phase === 'none') {
    out('not running')
    return
  }
  await stopRun(state.runId)
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
try {
  await commands[command]()
} catch (error) {
  fail(error.message)
}

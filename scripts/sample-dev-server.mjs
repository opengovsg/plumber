/**
 * Starts, checks and stops this worktree's `dev:sample-env` server for agents.
 *
 * Each command works from a fresh shell, so agents need not keep PIDs or log paths between tool calls.
 */
import { execFileSync, spawn } from 'node:child_process'
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
  try {
    return execFileSync('ps', ['-o', 'lstart=,command=', '-p', String(pid)], {
      encoding: 'utf8',
    }).trim()
  } catch {
    return undefined
  }
}

function readOwnedServer() {
  if (!existsSync(statePath)) {
    return undefined
  }
  const state = JSON.parse(readFileSync(statePath, 'utf8'))
  if (describeProcess(state.pid) === state.process) {
    return state
  }
  // The recorded server is gone, so its state file is stale.
  rmSync(statePath)
  return undefined
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
  writeFileSync(statePath, `${JSON.stringify(state)}\n`)

  // The log is truncated on start, so these lines can only come from this run.
  const backendReady = `Server is listening on ${ports.backendPort}`
  const frontendReady = `Local:   http://localhost:${ports.frontendPort}/`
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    const log = readLog()
    if (log.includes(backendReady) && log.includes(frontendReady)) {
      printUrls(ports)
      return
    }
    if (!readOwnedServer()) {
      fail(`the server exited during start. See ${logPath}.`)
    }
    await sleep(1000)
  }
  await stop()
  fail(
    `the server was not ready after ${READY_TIMEOUT_MS / 1000}s. See ${logPath}.`,
  )
}

function status() {
  const running = readOwnedServer()
  if (!running) {
    out('not running')
    return
  }
  out('running')
  printUrls(running)
}

async function stop() {
  const running = readOwnedServer()
  if (!running) {
    out('not running')
    return
  }

  // with-sample-env relays SIGTERM, so turbo shuts its tasks down cleanly.
  process.kill(running.pid, 'SIGTERM')
  const deadline = Date.now() + STOP_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (describeProcess(running.pid) !== running.process) {
      break
    }
    await sleep(500)
  }
  if (describeProcess(running.pid) === running.process) {
    // The detached child leads its own process group, so this reaches turbo's tasks too.
    process.kill(-running.pid, 'SIGKILL')
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

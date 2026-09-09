/**
 * Runs a command with variables from a 1Password Environment injected.
 *
 * Keeps local dev secrets off disk. See README.md for the one-time setup.
 */
import { createClient, DesktopAuth } from '@1password/sdk'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const CONFIG_FILE = 'op-dev.json'
const EXAMPLE_FILE = 'op-dev.example.json'
const USAGE =
  'usage: node scripts/with-op-env.mjs [--env <name>] <command> [args...]'

const configPath = path.join(import.meta.dirname, '..', CONFIG_FILE)

function fail(message) {
  console.error(`with-op-env: ${message}`)
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

async function fetchVariables(envName) {
  const config = readConfig()
  const environmentId = config.environments?.[envName]

  if (!config.accountName) {
    fail(`${CONFIG_FILE} has no "accountName".`)
  }
  if (!environmentId) {
    fail(`${CONFIG_FILE} has no environment id for "${envName}".`)
  }

  const client = await createOpClient(config.accountName)

  // Inherited environments hold common team-level env vars, so they load
  // first: a developer's own "--env" environment overrides any of them.
  const variables = {}
  for (const inheritedId of config.inheritedEnvironments ?? []) {
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
  // npm already split argv through sh -c, so a shell would re-parse quoted --exec values.
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

  // Shell exports win, because .superset/run.sh sets PORT, BASE_URL and WEB_APP_URL per worktree.
  run(command, { ...variables, ...process.env })
}

main()

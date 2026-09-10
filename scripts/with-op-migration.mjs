/**
 * Runs a knex command with variables from a 1Password Environment injected.
 *
 * VERY HIGH RISK: this can point knex at a real database, including production.
 * Unlike with-op-env.mjs, it never accepts a shortcut for picking the
 * environment. It always prompts for a menu choice, so the target database
 * is never chosen by a script or a stale flag.
 * See README.md for the one-time setup.
 */
import { createClient, DesktopAuth } from '@1password/sdk'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'

const CONFIG_FILE = 'op-dev.json'
const USAGE = 'usage: node scripts/with-op-migration.mjs <command> [args...]'

// Not a 1Password environment id; `id === LOCAL_DEV_ID` means skip 1Password
// entirely and rely on db.ts's own .env-example fallback.
const LOCAL_DEV_ID = 'local'

const ENVIRONMENTS = [
  { name: 'Production', id: 'dfbls6iae7ztmjupydxpb7fiua' },
  { name: 'Staging', id: '53u2c57c7vctht3s6yejgkbbm4' },
  { name: 'UAT', id: 'qcynixqrtebpcnqelwyl3lwytu' },
  { name: 'Local dev', id: LOCAL_DEV_ID },
]

const configPath = path.join(import.meta.dirname, '..', CONFIG_FILE)

function fail(message) {
  console.error(`with-op-migration: ${message}`)
  process.exit(1)
}

function readAccountName() {
  let raw
  try {
    raw = readFileSync(configPath, 'utf8')
  } catch {
    fail(
      `no ${CONFIG_FILE} at ${configPath}.\n` +
        'Follow the 1Password setup steps in README.md first (with-op-env.mjs uses the same file).',
    )
  }

  let config
  try {
    config = JSON.parse(raw)
  } catch (error) {
    fail(`${CONFIG_FILE} is not valid JSON. ${error.message}`)
  }

  if (!config.accountName) {
    fail(`${CONFIG_FILE} has no "accountName".`)
  }

  return config.accountName
}

async function createOpClient(accountName) {
  try {
    return await createClient({
      auth: new DesktopAuth(accountName),
      integrationName: 'Plumber DB migration',
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

async function fetchEnvironmentVariables(client, environmentId) {
  try {
    const { variables } = await client.environments.getVariables(environmentId)
    return Object.fromEntries(variables.map(({ name, value }) => [name, value]))
  } catch (error) {
    fail(
      `could not read 1Password environment "${environmentId}".\n` +
        'Check that:\n' +
        '  - the 1Password app is running and unlocked\n' +
        '  - Settings > Developer > Integrate with other apps is on\n' +
        `${error.message}`,
    )
  }
}

async function promptForEnvironment(rl) {
  console.log('Which database is this migration for?')
  ENVIRONMENTS.forEach((environment, index) => {
    console.log(`  ${index + 1}. ${environment.name}`)
  })

  const answer = (await rl.question('Enter a number: ')).trim()
  const environment = ENVIRONMENTS[Number(answer) - 1]
  if (!environment) {
    fail(`"${answer}" is not one of the choices above.`)
  }

  return environment
}

async function confirmDatabase(rl, environment, database) {
  const answer = await rl.question(
    `\nAbout to migrate database "${database}" (${environment.name}).\n` +
      'Continue? [y/N] ',
  )
  if (!/^y(es)?$/i.test(answer.trim())) {
    fail('aborted.')
  }
}

async function loadVariables(rl) {
  const environment = await promptForEnvironment(rl)

  if (environment.id === LOCAL_DEV_ID) {
    await confirmDatabase(
      rl,
      environment,
      '.env-example (local Docker Postgres)',
    )
    // APP_ENV must win over any stray shell value so db.ts's own dotenv
    // fallback (guarded on APP_ENV) definitely loads .env-example.
    return { APP_ENV: 'development' }
  }

  const accountName = readAccountName()
  const client = await createOpClient(accountName)
  const variables = await fetchEnvironmentVariables(client, environment.id)

  await confirmDatabase(
    rl,
    environment,
    variables.POSTGRES_DATABASE ?? '(not set in this 1Password environment)',
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
  const command = process.argv.slice(2)
  if (command.length === 0) {
    fail(USAGE)
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  let variables
  try {
    variables = await loadVariables(rl)
  } finally {
    rl.close()
  }

  // PATH is the only shell state the spawned command needs to even run.
  // Everything else, especially DB vars like RDS_PROXY_HOST, must come from
  // the confirmed environment alone, never inherited.
  run(command, { PATH: process.env.PATH, ...variables })
}

main()

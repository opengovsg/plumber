/**
 * Runs a command on `.env-example` placeholders, without 1Password.
 *
 * Gives each worktree its own ports, so several agents can run dev servers at once.
 */
import { fail, getWorktreePorts, run } from './dev-env-utils.mjs'

// IMPORTANT: anything else from the shell, e.g. an exported RDS_PROXY_HOST, would override the placeholders.
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
]

const command = process.argv.slice(2)
if (command.length === 0) {
  fail('usage: node scripts/with-sample-env.mjs <command> [args...]')
}

const shellEnv = Object.fromEntries(
  PASSTHROUGH_VARS.filter((name) => process.env[name] !== undefined).map(
    (name) => [name, process.env[name]],
  ),
)
const ports = await getWorktreePorts()
run(command, {
  ...shellEnv,
  ...ports,
  // Every flag reads its fallback value, since the placeholder SDK key fails LD auth.
  LAUNCH_DARKLY_OFFLINE: 'true',
})

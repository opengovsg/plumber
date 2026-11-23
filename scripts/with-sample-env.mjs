/**
 * Runs a command on `.env-example` placeholders, without 1Password.
 *
 * Gives each worktree its own ports, so several agents can run dev servers at once.
 */
import { fail, getWorktreePorts, run } from './dev-env-utils.mjs'

const command = process.argv.slice(2)
if (command.length === 0) {
  fail('usage: node scripts/with-sample-env.mjs <command> [args...]')
}

const ports = await getWorktreePorts()
// Every flag reads its fallback value, since the placeholder SDK key fails LD auth.
run(command, { LAUNCH_DARKLY_OFFLINE: 'true', ...ports, ...process.env })

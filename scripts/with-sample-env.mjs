/**
 * Runs a command on `.env-example` placeholders, without 1Password.
 *
 * Gives each worktree its own ports, so several agents can run dev servers at once.
 */
import path from 'node:path'

import { fail, getWorktreePorts, readShellEnv, run } from './dev-env-utils.mjs'

const command = process.argv.slice(2)
if (command.length === 0) {
  fail('usage: node scripts/with-sample-env.mjs <command> [args...]')
}

const ports = await getWorktreePorts()
run(command, {
  ...readShellEnv(),
  ...ports,
  // Every flag reads its fallback value, since the placeholder SDK key fails LD auth.
  LAUNCH_DARKLY_OFFLINE: 'true',
  // Git ignores tmp/, so each worktree keeps its own local flag values.
  LAUNCH_DARKLY_FLAG_FILE: path.join(
    import.meta.dirname,
    '..',
    'tmp',
    'ld-flags.json',
  ),
  // Vite would open the user's own browser, whose localhost cookie belongs to their session.
  BROWSER: 'none',
})

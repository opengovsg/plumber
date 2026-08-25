// @ts-check
import type { Rolldown } from 'vite'

/**
 * Guardrail for the @emailens/engine tech-debt: the engine declares
 * `engines.node: ">=18"` but the slice we use (transformForClient) is
 * browser-safe. If a future version of @emailens/engine — or any other
 * dep — starts importing a node-only module (fs, path, crypto, etc.),
 * Vite externalizes it and emits a warning. We promote that warning to
 * a hard error so CI catches the regression instead of silently
 * shipping a broken bundle.
 *
 * Wire this up as `build.rolldownOptions.onLog` in the Vite config.
 */
export const failOnLeakedNodeBuiltins: Rolldown.LogOrStringHandler = (
  level,
  log,
  defaultHandler,
) => {
  const msg = typeof log === 'string' ? log : (log.message ?? '')
  const code = typeof log === 'string' ? undefined : log.code
  if (
    (level === 'warn' || level === 'error') &&
    (msg.includes('has been externalized for browser compatibility') ||
      code === 'MISSING_NODE_BUILTINS')
  ) {
    throw new Error(
      `[vite-guardrail] A node-only import leaked into the frontend bundle. ` +
        `This guardrail exists to catch @emailens/engine (and similar libraries) ` +
        `pulling in backend-only modules. Original warning: ${msg}`,
    )
  }
  defaultHandler(level, log)
}

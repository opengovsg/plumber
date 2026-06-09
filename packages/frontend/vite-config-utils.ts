// @ts-check
import type { Rollup } from 'vite'

/**
 * Guardrail for the @emailens/engine tech-debt: the engine declares
 * `engines.node: ">=18"` but the slice we use (transformForClient) is
 * browser-safe. If a future version of @emailens/engine — or any other
 * dep — starts importing a node-only module (fs, path, crypto, etc.),
 * Vite externalizes it and emits a warning. We promote that warning to
 * a hard error so CI catches the regression instead of silently
 * shipping a broken bundle.
 *
 * Wire this up as `build.rollupOptions.onwarn` in the Vite config.
 */
export const failOnLeakedNodeBuiltins: Rollup.WarningHandlerWithDefault = (
  warning,
  defaultHandler,
) => {
  const msg = warning.message ?? ''
  if (
    msg.includes('has been externalized for browser compatibility') ||
    warning.code === 'MISSING_NODE_BUILTINS'
  ) {
    throw new Error(
      `[vite-guardrail] A node-only import leaked into the frontend bundle. ` +
        `This guardrail exists to catch @emailens/engine (and similar libraries) ` +
        `pulling in backend-only modules. Original warning: ${msg}`,
    )
  }
  defaultHandler(warning)
}

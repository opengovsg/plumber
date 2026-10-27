// @ts-check
import type { Plugin } from 'vite'

/**
 * Guardrail for the @emailens/engine tech-debt: the engine declares
 * `engines.node: ">=18"` but the slice we use (transformForClient) is
 * browser-safe. If a future version of @emailens/engine — or any other
 * dep — starts importing a node-only module (fs, path, crypto, etc.),
 * Vite externalizes it and emits a warning. We promote that warning to
 * a hard error so CI catches the regression instead of silently
 * shipping a broken bundle.
 *
 * IMPORTANT: Rolldown ignores errors thrown from `onLog`, so the build fails
 * from `buildEnd` instead.
 */
export function failOnLeakedNodeBuiltins(): Plugin {
  let leaks: string[] = []
  return {
    name: 'plumber:fail-on-leaked-node-builtins',
    apply: 'build',
    buildStart() {
      leaks = []
    },
    onLog(level, log) {
      if (
        level === 'warn' &&
        (log.message.includes(
          'has been externalized for browser compatibility',
        ) ||
          log.code === 'MISSING_NODE_BUILTINS')
      ) {
        leaks.push(log.message)
      }
    },
    buildEnd() {
      if (leaks.length > 0) {
        this.error(
          `[vite-guardrail] A node-only import leaked into the frontend bundle. ` +
            `This guardrail exists to catch @emailens/engine (and similar libraries) ` +
            `pulling in backend-only modules. Original warnings:\n${leaks.join('\n')}`,
        )
      }
    },
  }
}

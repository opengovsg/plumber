/**
 * Business rules (user decisions), quoted verbatim:
 *
 * - "Must not run inside the worker. A stalled or backlogged worker would
 *   stall it too, when it is needed most."
 * - "`src/reconciler.ts` must not import `workers/*` (only `worker.ts` may)."
 */
import fs from 'fs'
import path from 'path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const SRC_DIR = path.resolve(__dirname, '../../..')

const FORBIDDEN_FILES = ['worker.ts', 'server.ts', 'app.ts'].map((file) =>
  path.join(SRC_DIR, file),
)
const FORBIDDEN_DIR = path.join(SRC_DIR, 'workers') + path.sep

function resolveImport(fromFile: string, specifier: string): string | null {
  let basePath: string
  if (specifier.startsWith('@/')) {
    basePath = path.join(SRC_DIR, specifier.slice(2))
  } else if (specifier.startsWith('.')) {
    basePath = path.resolve(path.dirname(fromFile), specifier)
  } else {
    return null
  }

  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, 'index.ts'),
  ]
  return (
    candidates.find(
      (candidate) =>
        /\.tsx?$/.test(candidate) &&
        fs.existsSync(candidate) &&
        fs.statSync(candidate).isFile(),
    ) ?? null
  )
}

function collectReachableFiles(entryFile: string): Set<string> {
  const reached = new Set<string>([entryFile])
  const queue = [entryFile]

  while (queue.length > 0) {
    const file = queue.pop() as string
    const { importedFiles } = ts.preProcessFile(
      fs.readFileSync(file, 'utf8'),
      true,
      true,
    )

    for (const { fileName } of importedFiles) {
      const resolved = resolveImport(file, fileName)
      if (resolved && !reached.has(resolved)) {
        reached.add(resolved)
        queue.push(resolved)
      }
    }
  }

  return reached
}

function isForbidden(file: string): boolean {
  return FORBIDDEN_FILES.includes(file) || file.startsWith(FORBIDDEN_DIR)
}

describe('reconciler entry imports', () => {
  it('resolves `@/` imports, so the walk from the worker reaches its workers', () => {
    const reached = collectReachableFiles(path.join(SRC_DIR, 'worker.ts'))

    expect(reached).toContain(path.join(SRC_DIR, 'workers/flow.ts'))
  })

  it('never reaches the worker, server or app entry files', () => {
    const reached = collectReachableFiles(path.join(SRC_DIR, 'reconciler.ts'))

    expect(reached).toContain(path.join(SRC_DIR, 'models/step.ts'))    expect([...reached].filter(isForbidden)).toEqual([])
  })
})

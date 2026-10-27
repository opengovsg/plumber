/**
 * Business rules (user decisions), quoted verbatim:
 *
 * - "Must not run inside the worker. A stalled or backlogged worker would
 *   stall it too, when it is needed most."
 * - "`src/reconciler.ts` must not import `workers/*` (only `worker.ts` may)."
 */
import path from 'path'

import { describe, expect, it } from 'vitest'

import { collectReachableFiles, SRC_DIR } from './import-graph'

const FORBIDDEN_FILES = ['worker.ts', 'server.ts', 'app.ts'].map((file) =>
  path.join(SRC_DIR, file),
)
const FORBIDDEN_DIR = path.join(SRC_DIR, 'workers') + path.sep

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

    expect(reached).toContain(
      path.join(
        SRC_DIR,
        'services/reconciler/schedule-check/fetch-published-scheduled-pipes.ts',
      ),
    )
    expect([...reached].filter(isForbidden)).toEqual([])
  })
})

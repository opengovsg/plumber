/**
 * Business rules (user decisions), quoted verbatim:
 *
 * - "Prevent the reconciler from processing jobs by preventing importing
 *   worker code."
 * - "`src/reconciler.ts` must not import `workers/*` (only `worker.ts` may)."
 * - "The reconciler must not load the full app config, so its task declares
 *   only the env vars it uses."
 * - "Add a datetime.ts, in case later reconciler code calls into Luxon."
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

  it('never loads the full app config, whose required env vars the task omits', () => {
    const reached = collectReachableFiles(path.join(SRC_DIR, 'reconciler.ts'))

    expect(reached).not.toContain(path.join(SRC_DIR, 'config/app/core.ts'))
    expect(reached).not.toContain(path.join(SRC_DIR, 'config/app/index.ts'))
  })

  it('sets up Luxon like the app does', () => {
    const reached = collectReachableFiles(path.join(SRC_DIR, 'reconciler.ts'))

    expect(reached).toContain(path.join(SRC_DIR, 'config/datetime.ts'))
  })
})

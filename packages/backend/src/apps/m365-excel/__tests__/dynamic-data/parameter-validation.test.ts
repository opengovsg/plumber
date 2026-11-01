import type { IDynamicData, IGlobalVariable } from '@plumber/types'
import { describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'

import listTableColumns from '../../dynamic-data/list-table-columns'
import listTables from '../../dynamic-data/list-tables'
import listWorksheets from '../../dynamic-data/list-worksheets'

const mocks = vi.hoisted(() => ({
  validateCanAccessFile: vi.fn(),
}))

vi.mock('../../common/file-privacy', () => ({
  validateCanAccessFile: mocks.validateCanAccessFile,
}))

describe.each<[string, IDynamicData]>([
  ['listTables', listTables],
  ['listWorksheets', listWorksheets],
  ['listTableColumns', listTableColumns],
])('%s', (_key, dynamicData) => {
  it('throws a config StepError on invalid parameters', async () => {
    const $ = {
      step: { parameters: { fileId: 'not a file id!', tableId: '{table}' } },
    } as unknown as IGlobalVariable

    const error = await dynamicData.run($).catch((err: unknown) => err)
    expect(error).toBeInstanceOf(StepError)
    expect(error).toMatchObject({ kind: 'config' })
    expect(mocks.validateCanAccessFile).not.toHaveBeenCalled()
  })
})

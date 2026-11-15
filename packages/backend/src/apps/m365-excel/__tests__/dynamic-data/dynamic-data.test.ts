import type { IDynamicData, IGlobalVariable } from '@plumber/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'
import { UserFacingError } from '@/errors/user-facing-error'

import listTableColumns from '../../dynamic-data/list-table-columns'
import listTables from '../../dynamic-data/list-tables'
import listWorksheets from '../../dynamic-data/list-worksheets'

const mocks = vi.hoisted(() => ({
  validateCanAccessFile: vi.fn(),
}))

vi.mock('../../common/file-privacy', () => ({
  validateCanAccessFile: mocks.validateCanAccessFile,
}))

vi.mock('../../common/auth-data', () => ({
  extractAuthDataWithPlumberFolder: () => ({
    tenantKey: 'local-dev',
    folderId: 'FOLDER',
  }),
}))

describe.each<[string, IDynamicData]>([
  ['listTables', listTables],
  ['listWorksheets', listWorksheets],
  ['listTableColumns', listTableColumns],
])('%s', (_key, dynamicData) => {
  const validParameters = { fileId: 'file-1', tableId: '{table-1}' }

  beforeEach(() => {
    mocks.validateCanAccessFile.mockReset()
  })

  it('throws a config StepError on invalid parameters', async () => {
    const $ = {
      step: { parameters: { fileId: 'not a file id!', tableId: '{table}' } },
    } as unknown as IGlobalVariable

    const error = await dynamicData.run($).catch((err: unknown) => err)
    expect(error).toBeInstanceOf(StepError)
    expect(error).toMatchObject({ kind: 'config' })
    expect(mocks.validateCanAccessFile).not.toHaveBeenCalled()
  })

  it('rethrows a file access StepError as a UserFacingError with its name', async () => {
    mocks.validateCanAccessFile.mockRejectedValue(
      new StepError({
        name: 'File must be in your Plumber folder',
        solution: 'Move the file into your Plumber folder.',
        kind: 'config',
      }),
    )
    const $ = {
      step: { parameters: validParameters },
    } as unknown as IGlobalVariable

    const error = await dynamicData.run($).catch((err: unknown) => err)
    expect(error).toBeInstanceOf(UserFacingError)
    expect((error as Error).message).toBe('File must be in your Plumber folder')
  })

  it('rethrows any other file access error unchanged', async () => {
    const accessError = new Error('boom')
    mocks.validateCanAccessFile.mockRejectedValue(accessError)
    const $ = {
      step: { parameters: validParameters },
    } as unknown as IGlobalVariable

    await expect(dynamicData.run($)).rejects.toBe(accessError)
  })
})

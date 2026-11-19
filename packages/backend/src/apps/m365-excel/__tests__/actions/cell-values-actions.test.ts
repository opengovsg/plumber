import type { IGlobalVariable } from '@plumber/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'

import getCellValuesAction from '../../actions/get-cell-values'
import writeCellValuesAction from '../../actions/write-cell-values'

const mocks = vi.hoisted(() => ({
  acquire: vi.fn(),
}))

vi.mock('../../common/workbook-session', () => ({
  default: { acquire: mocks.acquire },
}))

function makeGlobalVariable(parameters: Record<string, unknown>) {
  return {
    step: { id: 'step-id', parameters },
    execution: { id: 'execution-id', testRun: false },
    setActionItem: vi.fn(),
  } as unknown as IGlobalVariable
}

async function catchStepError(promise: Promise<unknown>): Promise<StepError> {
  const error = await promise.then(
    (): unknown => undefined,
    (err: unknown): unknown => err,
  )
  expect(error).toBeInstanceOf(StepError)
  return error as StepError
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('getCellValues', () => {
  it('throws a config StepError on invalid parameters', async () => {
    const error = await catchStepError(
      getCellValuesAction.run(
        makeGlobalVariable({
          fileId: 'file-1',
          worksheetId: '{sheet-1}',
          cells: [{ address: 'not an address' }],
        }),
      ),
    )
    expect(error.kind).toBe('config')
    expect(mocks.acquire).not.toHaveBeenCalled()
  })

  it('throws a config StepError for more than 3 cells', async () => {
    const error = await catchStepError(
      getCellValuesAction.run(
        makeGlobalVariable({
          fileId: 'file-1',
          worksheetId: '{sheet-1}',
          cells: ['A1', 'A2', 'A3', 'A4'].map((address) => ({ address })),
        }),
      ),
    )
    expect(error.kind).toBe('config')
    expect(mocks.acquire).not.toHaveBeenCalled()
  })
})

describe('writeCellValues', () => {
  it('throws a config StepError on invalid parameters', async () => {
    const error = await catchStepError(
      writeCellValuesAction.run(
        makeGlobalVariable({
          fileId: 'file-1',
          worksheetId: '{sheet-1}',
          cells: [{ address: 'not an address', value: 'x' }],
        }),
      ),
    )
    expect(error.kind).toBe('config')
    expect(mocks.acquire).not.toHaveBeenCalled()
  })
})

import type { IGlobalVariable } from '@plumber/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'

import getTableRowAction from '../../actions/get-table-row'
import getTableRowsAction from '../../actions/get-table-rows'
import updateTableRowAction from '../../actions/update-table-row'
import { TEST_STEP_MAX_COLUMNS } from '../../common/constants'

const mocks = vi.hoisted(() => ({
  acquire: vi.fn(),
  request: vi.fn(),
  getTopNTableRows: vi.fn(),
}))

vi.mock('../../common/workbook-session', () => ({
  default: { acquire: mocks.acquire },
}))

vi.mock('../../common/get-top-n-table-rows', () => ({
  default: mocks.getTopNTableRows,
}))

vi.mock('../../FOR_RELEASE_PERIOD_ONLY', () => ({
  RATE_LIMIT_FOR_RELEASE_ONLY_REMOVE_AFTER_JULY_2024: vi.fn(),
}))

const COLUMNS = ['Name', 'Age']

function makeGlobalVariable(
  parameters: Record<string, unknown>,
  testRun = false,
): IGlobalVariable {
  return {
    user: { email: 'tester@open.gov.sg' },
    flow: { id: 'flow-id' },
    step: { id: 'step-id', appKey: 'm365-excel', parameters },
    execution: { id: 'execution-id', testRun },
    setActionItem: vi.fn(),
  } as unknown as IGlobalVariable
}

const lookupParameters = {
  fileId: 'file-1',
  tableId: '{table-1}',
  filters: [{ lookupColumn: 'Name', lookupValue: 'Alice' }],
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
  mocks.acquire.mockResolvedValue({ request: mocks.request })
  mocks.getTopNTableRows.mockResolvedValue({
    columns: COLUMNS,
    rows: [['Alice', '30']],
    headerSheetRowIndex: 0,
  })
})

describe('getTableRows', () => {
  it('throws a config StepError on invalid parameters', async () => {
    const error = await catchStepError(
      getTableRowsAction.run(
        makeGlobalVariable({ ...lookupParameters, filters: [] }),
      ),
    )
    expect(error.kind).toBe('config')
  })

  it('throws a config StepError when a test run reads a table with too many columns', async () => {
    mocks.getTopNTableRows.mockResolvedValue({
      columns: Array.from(
        { length: TEST_STEP_MAX_COLUMNS + 1 },
        (_, i) => `Column ${i}`,
      ),
      rows: [],
      headerSheetRowIndex: 0,
    })
    const error = await catchStepError(
      getTableRowsAction.run(makeGlobalVariable(lookupParameters, true)),
    )
    expect(error.kind).toBe('config')
  })

  it('throws a config StepError when the lookup column does not exist', async () => {
    const error = await catchStepError(
      getTableRowsAction.run(
        makeGlobalVariable({
          ...lookupParameters,
          filters: [{ lookupColumn: 'Missing', lookupValue: 'x' }],
        }),
      ),
    )
    expect(error.kind).toBe('config')
  })
})

describe('getTableRow', () => {
  it('throws a config StepError on invalid parameters', async () => {
    const error = await catchStepError(
      getTableRowAction.run(
        makeGlobalVariable({ ...lookupParameters, tableId: 'bad' }),
      ),
    )
    expect(error.kind).toBe('config')
  })
})

describe('updateTableRow', () => {
  const updateParameters = {
    ...lookupParameters,
    columnsToUpdate: [{ columnName: 'Age', value: '31' }],
  }

  it('throws a config StepError on invalid parameters', async () => {
    const error = await catchStepError(
      updateTableRowAction.run(
        makeGlobalVariable({ ...updateParameters, columnsToUpdate: [] }),
      ),
    )
    expect(error.kind).toBe('config')
  })

  it('throws a config StepError when a column to update does not exist', async () => {
    const error = await catchStepError(
      updateTableRowAction.run(
        makeGlobalVariable({
          ...updateParameters,
          columnsToUpdate: [{ columnName: 'Missing', value: 'x' }],
        }),
      ),
    )
    expect(error.kind).toBe('config')
    expect(mocks.request).not.toHaveBeenCalled()
  })

  it('throws a third-party StepError when Graph returns an unexpected row after the update', async () => {
    mocks.request.mockResolvedValue({ data: { values: [] } })
    const error = await catchStepError(
      updateTableRowAction.run(makeGlobalVariable(updateParameters)),
    )
    expect(error.kind).toBe('third-party')
  })
})

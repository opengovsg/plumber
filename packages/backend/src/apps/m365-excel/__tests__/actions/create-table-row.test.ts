import { IGlobalVariable } from '@plumber/types'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import createTableRowAction from '../../actions/create-table-row'

// Mock dependencies
const mocks = vi.hoisted(() => ({
  acquire: vi.fn(),
  request: vi.fn(),
}))

vi.mock('../../common/workbook-session', () => ({
  default: {
    acquire: mocks.acquire,
  },
}))

// Keep this a true unit test: the test-run rate-limit guard constructs a real
// Redis-backed rate limiter at import time, so stub the whole module out.
vi.mock('../../FOR_RELEASE_PERIOD_ONLY', () => ({
  RATE_LIMIT_FOR_RELEASE_ONLY_REMOVE_AFTER_JULY_2024: vi.fn(),
}))

// 0-indexed header row => header sits at sheet row HEADER_ROW_INDEX + 1 (= 10).
const HEADER_ROW_INDEX = 9
const TABLE_COLUMNS = ['Name', 'Age']

function makeGlobalVariable(
  parameters: Record<string, unknown>,
): IGlobalVariable {
  return {
    user: { email: 'tester@open.gov.sg' },
    flow: { id: 'flow-id' },
    step: {
      id: 'step-id',
      appKey: 'm365-excel',
      key: createTableRowAction.key,
      position: 2,
      parameters,
    },
    execution: {
      id: 'execution-id',
      testRun: false,
    },
    setActionItem: vi.fn(),
  } as unknown as IGlobalVariable
}

function rowParameters(name: string, age: string) {
  return {
    fileId: 'file-1',
    tableId: '{table-1}',
    columnValues: [
      { columnName: 'Name', value: name },
      { columnName: 'Age', value: age },
    ],
  }
}

// Returns the config object passed to each POST /rows request.
function postCalls() {
  return mocks.request.mock.calls.filter(([, method]) => method === 'post')
}

function getCalls() {
  return mocks.request.mock.calls.filter(([, method]) => method === 'get')
}

// First-inserted-row table-index returned by the POST (Approach A).
function mockGraph(firstRowIndex: number) {
  mocks.request.mockImplementation(
    async (_endpoint: string, method: string) => {
      if (method === 'get') {
        return { data: { rowIndex: HEADER_ROW_INDEX, values: [TABLE_COLUMNS] } }
      }
      return { data: { index: firstRowIndex } }
    },
  )
}

describe('createTableRow runBatch', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.acquire.mockResolvedValue({ request: mocks.request })
    mockGraph(0)
  })

  it('issues a single multi-row POST and a single header fetch for the whole batch', async () => {
    mockGraph(3)

    const jobs = [
      { $: makeGlobalVariable(rowParameters('Alice', '30')) },
      { $: makeGlobalVariable(rowParameters('Bob', '40')) },
      { $: makeGlobalVariable(rowParameters('Carol', '50')) },
    ]

    await createTableRowAction.runBatch(jobs)

    // Header read once, rows written in a single POST.
    expect(getCalls()).toHaveLength(1)
    expect(postCalls()).toHaveLength(1)

    const [, , postConfig] = postCalls()[0]
    expect(postConfig.data.index).toBeNull()
    // Each job contributes one ordered row, in batch order.
    expect(postConfig.data.values).toEqual([
      ['Alice', '30'],
      ['Bob', '40'],
      ['Carol', '50'],
    ])
  })

  it('gives each job its own sheetRowNumber from the first inserted index + offset', async () => {
    // First inserted row is at table-index 3 (relative to the header row).
    mockGraph(3)

    const jobs = [
      { $: makeGlobalVariable(rowParameters('Alice', '30')) },
      { $: makeGlobalVariable(rowParameters('Bob', '40')) },
      { $: makeGlobalVariable(rowParameters('Carol', '50')) },
    ]

    await createTableRowAction.runBatch(jobs)

    // sheetRowNumber = HEADER_ROW_INDEX + 1 + (firstIndex + i) + 1
    //               = 9 + 1 + (3 + i) + 1 = 14 + i
    expect(jobs[0].$.setActionItem).toHaveBeenCalledWith({
      raw: { sheetRowNumber: 14, success: true },
    })
    expect(jobs[1].$.setActionItem).toHaveBeenCalledWith({
      raw: { sheetRowNumber: 15, success: true },
    })
    expect(jobs[2].$.setActionItem).toHaveBeenCalledWith({
      raw: { sheetRowNumber: 16, success: true },
    })
  })

  it('sanitises formula injection in row values', async () => {
    const job = {
      $: makeGlobalVariable(rowParameters('=HYPERLINK("http://evil")', '1')),
    }

    await createTableRowAction.runBatch([job])

    const [, , postConfig] = postCalls()[0]
    expect(postConfig.data.values[0][0]).toBe(`'=HYPERLINK("http://evil")`)
  })

  it('throws and sets no action items if the POST fails (all-or-none)', async () => {
    mocks.request.mockImplementation(
      async (_endpoint: string, method: string) => {
        if (method === 'get') {
          return {
            data: { rowIndex: HEADER_ROW_INDEX, values: [TABLE_COLUMNS] },
          }
        }
        throw new Error('Graph POST failed')
      },
    )

    const jobs = [
      { $: makeGlobalVariable(rowParameters('Alice', '30')) },
      { $: makeGlobalVariable(rowParameters('Bob', '40')) },
    ]

    await expect(createTableRowAction.runBatch(jobs)).rejects.toThrow(
      'Graph POST failed',
    )
    expect(jobs[0].$.setActionItem).not.toHaveBeenCalled()
    expect(jobs[1].$.setActionItem).not.toHaveBeenCalled()
  })

  it('throws before touching Graph if any job has invalid params', async () => {
    const jobs = [
      { $: makeGlobalVariable(rowParameters('Alice', '30')) },
      {
        $: makeGlobalVariable({
          fileId: 'file-1',
          tableId: '{table-1}',
          columnValues: [], // violates .min(1)
        }),
      },
    ]

    await expect(createTableRowAction.runBatch(jobs)).rejects.toThrow()
    // Validation runs before any session is acquired.
    expect(mocks.acquire).not.toHaveBeenCalled()
    expect(jobs[0].$.setActionItem).not.toHaveBeenCalled()
  })

  it('throws if the batch mixes different files or tables', async () => {
    const jobs = [
      { $: makeGlobalVariable(rowParameters('Alice', '30')) },
      {
        $: makeGlobalVariable({
          fileId: 'file-1',
          tableId: '{table-2}', // different table
          columnValues: [{ columnName: 'Name', value: 'Bob' }],
        }),
      },
    ]

    await expect(createTableRowAction.runBatch(jobs)).rejects.toThrow(
      /different files or tables/,
    )
    expect(mocks.acquire).not.toHaveBeenCalled()
  })

  it('is a no-op for an empty batch', async () => {
    await expect(createTableRowAction.runBatch([])).resolves.toBeUndefined()
    expect(mocks.acquire).not.toHaveBeenCalled()
  })
})

describe('createTableRow run (single-row delegation)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.acquire.mockResolvedValue({ request: mocks.request })
    mockGraph(0)
  })

  it('delegates to runBatch and produces one row with the right sheetRowNumber', async () => {
    const $ = makeGlobalVariable(rowParameters('Solo', '99'))

    await createTableRowAction.run($)

    expect(postCalls()).toHaveLength(1)
    const [, , postConfig] = postCalls()[0]
    expect(postConfig.data.values).toEqual([['Solo', '99']])
    // 9 + 1 + (0 + 0) + 1 = 11
    expect($.setActionItem).toHaveBeenCalledWith({
      raw: { sheetRowNumber: 11, success: true },
    })
  })
})

import { IGlobalVariable } from '@plumber/types'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import RetriableError from '@/errors/retriable-error'

import createTableRowAction from '../../actions/create-table-row'

// Mock dependencies
const mocks = vi.hoisted(() => ({
  acquire: vi.fn(),
  request: vi.fn(),
  // runBatch authorizes file access ONCE per batch (every job in a batch shares
  // one connection). Default: access granted; the denial test overrides it.
  validateCanAccessFile: vi.fn(),
}))

vi.mock('../../common/workbook-session', () => ({
  default: {
    acquire: mocks.acquire,
  },
}))

vi.mock('../../common/file-privacy', () => ({
  validateCanAccessFile: mocks.validateCanAccessFile,
}))

// runBatch passes auth data (via extractAuthDataWithPlumberFolder) to
// validateCanAccessFile. Both are mocked here, so the stub `$`'s auth need not
// be real - extractAuthDataWithPlumberFolder always returns this dummy.
vi.mock('../../common/auth-data', () => ({
  extractAuthDataWithPlumberFolder: () => ({
    tenantKey: 'tenant',
    folderId: 'FOLDER',
  }),
}))

// Keep this a true unit test: the test-run rate-limit guard constructs a real
// Redis-backed rate limiter at import time, so stub the whole module out.
vi.mock('../../FOR_RELEASE_PERIOD_ONLY', () => ({
  RATE_LIMIT_FOR_RELEASE_ONLY_REMOVE_AFTER_JULY_2024: vi.fn(),
}))

// 0-indexed header row => header sits at sheet row HEADER_ROW_INDEX + 1 (= 10).
const HEADER_ROW_INDEX = 9
const TABLE_COLUMNS = ['Name', 'Age']

// `identity` overrides the access identity (pipe owner + connection + auth
// data) that runBatch asserts is uniform across a batch. Defaults make every
// job share one identity (the normal case: group affinity pins a batch to one
// connection); the mixed-batch tests vary one dimension to exercise the guard.
function makeGlobalVariable(
  parameters: Record<string, unknown>,
  identity: {
    email?: string
    connectionId?: string
    tenantKey?: string
    folderId?: string
  } = {},
): IGlobalVariable {
  return {
    user: { email: identity.email ?? 'tester@open.gov.sg' },
    auth: {
      connectionId: identity.connectionId ?? 'conn-default',
      data: {
        tenantKey: identity.tenantKey ?? 'tenant',
        folderId: identity.folderId ?? 'FOLDER',
      },
    },
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
    mocks.validateCanAccessFile.mockResolvedValue(undefined)
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

  it('isolates a job with invalid params and still writes the valid jobs', async () => {
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

    const results = await createTableRowAction.runBatch(jobs)

    // The valid job committed; the bad one was reported failed and excluded.
    expect(results[0]).toEqual({ status: 'success' })
    expect(results[1].status).toBe('failed')

    // One POST carrying only the valid job's row.
    expect(postCalls()).toHaveLength(1)
    const [, , postConfig] = postCalls()[0]
    expect(postConfig.data.values).toEqual([['Alice', '30']])

    expect(jobs[0].$.setActionItem).toHaveBeenCalled()
    expect(jobs[1].$.setActionItem).not.toHaveBeenCalled()
  })

  it('isolates a job whose column does not exist and still writes the valid jobs', async () => {
    // First inserted row at table-index 3 (relative to the header row).
    mockGraph(3)

    const jobs = [
      { $: makeGlobalVariable(rowParameters('Alice', '30')) },
      {
        $: makeGlobalVariable({
          fileId: 'file-1',
          tableId: '{table-1}',
          // Passes the params schema (a valid, non-empty string), but no such
          // column exists in the table - so it survives the per-job parse and
          // fails only at row-build time, against the real table columns.
          columnValues: [{ columnName: 'Nonexistent', value: 'x' }],
        }),
      },
      { $: makeGlobalVariable(rowParameters('Carol', '50')) },
    ]

    const results = await createTableRowAction.runBatch(jobs)

    // The bad-column job is isolated; the whole batch is NOT sunk.
    expect(results[0]).toEqual({ status: 'success' })
    expect(results[1].status).toBe('failed')
    expect(results[2]).toEqual({ status: 'success' })

    // One POST carrying only the two valid rows; the un-buildable row is excluded.
    expect(postCalls()).toHaveLength(1)
    const [, , postConfig] = postCalls()[0]
    expect(postConfig.data.values).toEqual([
      ['Alice', '30'],
      ['Carol', '50'],
    ])

    // sheetRowNumber uses the position in the WRITTEN set, not the batch index:
    // the surviving rows are contiguous from firstRowIndex 3, so
    // 9 + 1 + (3 + 0) + 1 = 14 and 9 + 1 + (3 + 1) + 1 = 15.
    expect(jobs[0].$.setActionItem).toHaveBeenCalledWith({
      raw: { sheetRowNumber: 14, success: true },
    })
    expect(jobs[2].$.setActionItem).toHaveBeenCalledWith({
      raw: { sheetRowNumber: 15, success: true },
    })
    expect(jobs[1].$.setActionItem).not.toHaveBeenCalled()
  })

  it('reports every job failed and never touches Graph when all jobs are invalid', async () => {
    const jobs = [
      {
        $: makeGlobalVariable({
          fileId: 'file-1',
          tableId: '{table-1}',
          columnValues: [], // violates .min(1)
        }),
      },
    ]

    const results = await createTableRowAction.runBatch(jobs)

    expect(results[0].status).toBe('failed')
    // No valid jobs => no session, no POST.
    expect(mocks.acquire).not.toHaveBeenCalled()
    expect(postCalls()).toHaveLength(0)
    expect(jobs[0].$.setActionItem).not.toHaveBeenCalled()
  })

  it('checks file access once for the whole batch', async () => {
    const jobs = [
      { $: makeGlobalVariable(rowParameters('Alice', '30')) },
      { $: makeGlobalVariable(rowParameters('Bob', '40')) },
      { $: makeGlobalVariable(rowParameters('Carol', '50')) },
    ]

    await createTableRowAction.runBatch(jobs)

    // One access check authorizes the entire batch (every job shares one
    // connection), and all three rows land in the single POST.
    expect(mocks.validateCanAccessFile).toHaveBeenCalledTimes(1)
    expect(postCalls()).toHaveLength(1)
    expect(postCalls()[0][2].data.values).toHaveLength(3)
  })

  it('fails the whole batch when the shared file-access check is denied', async () => {
    mocks.validateCanAccessFile.mockReset()
    mocks.validateCanAccessFile.mockRejectedValue(
      new Error('You need write access to use this file.'),
    )

    const jobs = [
      { $: makeGlobalVariable(rowParameters('Alice', '30')) },
      { $: makeGlobalVariable(rowParameters('Bob', '40')) },
    ]

    const results = await createTableRowAction.runBatch(jobs)

    // The batch shares one connection, so access is checked once and a denial
    // isolates every job - no session, no POST, no outputs.
    expect(mocks.validateCanAccessFile).toHaveBeenCalledTimes(1)
    expect(results.every((r) => r.status === 'failed')).toBe(true)
    expect(mocks.acquire).not.toHaveBeenCalled()
    expect(postCalls()).toHaveLength(0)
    jobs.forEach((job) => expect(job.$.setActionItem).not.toHaveBeenCalled())
  })

  it('rethrows a transient access-check error so the whole batch retries', async () => {
    mocks.validateCanAccessFile.mockReset()
    // A transient Graph error surfaces as RetriableError (via the m365 http
    // interceptor). Since one check now covers the whole batch, isolating would
    // permanently fail every job on one blip - so it must THROW and let the
    // worker retry the batch, NOT isolate.
    mocks.validateCanAccessFile.mockRejectedValue(
      new RetriableError({
        error: 'Encountered HTTP 503 from MS',
        delayInMs: 'default',
        delayType: 'step',
      }),
    )

    const jobs = [
      { $: makeGlobalVariable(rowParameters('Alice', '30')) },
      { $: makeGlobalVariable(rowParameters('Bob', '40')) },
    ]

    await expect(createTableRowAction.runBatch(jobs)).rejects.toBeInstanceOf(
      RetriableError,
    )
    // No isolation, no write: the throw routes to the worker's retry path.
    expect(mocks.acquire).not.toHaveBeenCalled()
    expect(postCalls()).toHaveLength(0)
  })

  // Group affinity should make a mixed-identity batch impossible (the identity
  // is pinned by the group key), but if it ever happens the batch must NOT be
  // authorized by one job's single access check, nor written under one job's
  // session. The single check consumes email + connection + auth data
  // (tenant/folder), so a mismatch in ANY of those must throw before the check.
  it.each([
    ['connection', { connectionId: 'conn-other' }],
    ['user email', { email: 'someone-else@open.gov.sg' }],
    ['tenant', { tenantKey: 'other-tenant' }],
    ['Plumber folder', { folderId: 'OTHER-FOLDER' }],
  ])(
    'throws if the batch mixes a different %s',
    async (_dimension, identityOverride) => {
      const jobs = [
        { $: makeGlobalVariable(rowParameters('Alice', '30')) },
        { $: makeGlobalVariable(rowParameters('Bob', '40'), identityOverride) },
      ]

      await expect(createTableRowAction.runBatch(jobs)).rejects.toThrow(
        /different access identities/,
      )
      expect(mocks.validateCanAccessFile).not.toHaveBeenCalled()
      expect(mocks.acquire).not.toHaveBeenCalled()
    },
  )

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
    await expect(createTableRowAction.runBatch([])).resolves.toEqual([])
    expect(mocks.acquire).not.toHaveBeenCalled()
  })
})

describe('createTableRow run (single-row delegation)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.acquire.mockResolvedValue({ request: mocks.request })
    mocks.validateCanAccessFile.mockResolvedValue(undefined)
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

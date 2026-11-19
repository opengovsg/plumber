import type { IGlobalVariable } from '@plumber/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'

import createRowAction from '../../actions/create-row'

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  executeStatement: vi.fn(),
  fetchAll: vi.fn(),
  endSession: vi.fn(),
}))

vi.mock('../../auth/create-client', () => ({
  createSession: mocks.createSession,
}))

describe('create row', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchAll.mockResolvedValue([])
    mocks.executeStatement.mockResolvedValue({ fetchAll: mocks.fetchAll })
    mocks.endSession.mockResolvedValue(undefined)
    mocks.createSession.mockResolvedValue({
      session: { executeStatement: mocks.executeStatement },
      endSession: mocks.endSession,
    })
    $ = {
      step: {
        id: 'step-id',
        appKey: 'databricks',
        key: 'createDatabricksTableRow',
        position: 2,
        parameters: {
          tableName: 'my_table',
          rowData: [{ columnName: 'name', columnValue: 'alice' }],
        },
      },
      flow: { id: 'flow-id' },
      execution: { id: 'execution-id', testRun: false },
      setActionItem: vi.fn(),
    } as unknown as IGlobalVariable
  })

  it('inserts the row', async () => {
    await createRowAction.run($)

    expect(mocks.executeStatement).toHaveBeenCalledWith(
      'INSERT INTO `my_table` (`name`) VALUES (:val0)',
      { namedParameters: { val0: 'alice' } },
    )
    expect($.setActionItem).toHaveBeenCalledWith({ raw: { success: true } })
    expect(mocks.endSession).toHaveBeenCalled()
  })

  it('throws a config StepError when parameters are invalid', async () => {
    $.step.parameters = { tableName: 'my_table', rowData: [] }

    await expect(createRowAction.run($)).rejects.toMatchObject({
      kind: 'config',
      message: expect.stringContaining(
        '"name":"Ensure your values are correct"',
      ),
    })
    expect(mocks.createSession).not.toHaveBeenCalled()
  })

  it('throws a third-party StepError when the session cannot be created', async () => {
    mocks.createSession.mockRejectedValue(
      new Error('Failed to connect to Databricks'),
    )

    const error = await createRowAction.run($).catch((e) => e)

    expect(error).toBeInstanceOf(StepError)
    expect(error).toMatchObject({
      kind: 'third-party',
      message: expect.stringContaining('"name":"Failed to create session"'),
    })
    expect(error.cause).toBeUndefined()
  })

  it('throws a third-party StepError when the statement fails', async () => {
    mocks.executeStatement.mockRejectedValue(
      new Error('[UNRESOLVED_COLUMN] column `name` cannot be resolved'),
    )

    const error = await createRowAction.run($).catch((e) => e)

    expect(error).toBeInstanceOf(StepError)
    expect(error).toMatchObject({
      kind: 'third-party',
      message: expect.stringContaining('"name":"Failed to create row"'),
    })
    expect(error.cause).toBeUndefined()
    expect(mocks.endSession).toHaveBeenCalled()
  })

  it('throws a third-party StepError when fetching the result fails', async () => {
    mocks.fetchAll.mockRejectedValue(new Error('Operation timed out'))

    await expect(createRowAction.run($)).rejects.toMatchObject({
      kind: 'third-party',
      message: expect.stringContaining('"name":"Failed to create row"'),
    })
    expect(mocks.endSession).toHaveBeenCalled()
  })
})

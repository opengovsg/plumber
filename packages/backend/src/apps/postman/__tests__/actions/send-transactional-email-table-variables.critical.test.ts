/**
 * Business rules:
 * - Table variables are capped at 100 columns and 500 rows. All tables in one
 *   step share a 10 MB HTML budget.
 * - Over a cap: "we should log and fail the step. it should not remove the
 *   table automatically".
 */
import { randomUUID } from 'crypto'

import {
  MAX_TABLE_VARIABLE_COLUMNS,
  MAX_TABLE_VARIABLE_ROWS,
} from '@plumber/shared'
import type { IGlobalVariable, IJSONObject } from '@plumber/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import StepError, { getStepErrorKind } from '@/errors/step'
import computeParameters, {
  isTableLimitExceeded,
} from '@/helpers/compute-parameters'
import { hexEncode } from '@/helpers/hex-encoding'
import logger from '@/helpers/logger'
import ExecutionStep from '@/models/execution-step'

import sendTransactionalEmail from '../../actions/send-transactional-email'

const stepId = randomUUID()
const columnsOf = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `c${i}`, name: `Col ${i}` }))
const rowsOf = (count: number, data: Record<string, string> = {}) =>
  Array.from({ length: count }, () => ({ data }))

const executionSteps = [
  {
    stepId,
    dataOut: {
      // About 3.8 MB of HTML each, so two fit in the 10 MB budget.
      wide: {
        rows: rowsOf(300),
        columns: columnsOf(MAX_TABLE_VARIABLE_COLUMNS),
      },
      tooWide: {
        rows: rowsOf(1),
        columns: columnsOf(MAX_TABLE_VARIABLE_COLUMNS + 1),
      },
      tooLong: {
        rows: rowsOf(MAX_TABLE_VARIABLE_ROWS + 1),
        columns: columnsOf(1),
      },
      tooBig: {
        rows: rowsOf(1, { c0: 'x'.repeat(11 * 1024 * 1024) }),
        columns: columnsOf(1),
      },
      spoof: {
        __type: 'table',
        data: {
          rows: rowsOf(300),
          columns: columnsOf(MAX_TABLE_VARIABLE_COLUMNS),
        },
        selectedColumnIds: columnsOf(MAX_TABLE_VARIABLE_COLUMNS).map(
          (c) => c.id,
        ),
        renderBudget: { bytes: 1e12 },
      },
    },
  } as unknown as ExecutionStep,
]

const tableVariable = (path: string, columnCount: number) =>
  `{{step.${stepId}.${path}|${hexEncode(
    `table:${columnsOf(columnCount)
      .map((c) => c.id)
      .join(',')}`,
  )}}}`
const wide = tableVariable('wide', MAX_TABLE_VARIABLE_COLUMNS)

function render(parameters: Record<string, unknown>) {
  return computeParameters(
    parameters as IJSONObject,
    executionSteps,
    sendTransactionalEmail.preprocessVariable,
  )
}

const countTables = (value: unknown) =>
  (JSON.stringify(value).match(/<table/g) ?? []).length

function makeGlobal(parameters: IJSONObject, testRun: boolean) {
  return {
    step: { parameters, position: 2 },
    execution: { testRun },
    user: { email: 'tester@open.gov.sg' },
    flow: { id: 'flow-id', name: 'Test Flow' },
    app: { name: 'Email by Postman' },
    http: { post: vi.fn() },
    setActionItem: vi.fn(),
    getLastExecutionStep: vi.fn(),
  } as unknown as IGlobalVariable
}

describe('send email table variables', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'warn')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders tables in the body within the step budget', () => {
    const result = render({ body: wide.repeat(2) })
    expect(countTables(result)).toBe(2)
    expect(isTableLimitExceeded(result)).toBe(false)
  })

  it('does not render upstream data that resembles a table marker', () => {
    const result = render({ body: `{{step.${stepId}.spoof}}` })
    expect(countTables(result)).toBe(0)
  })

  it('never saves the limit flag with the parameters', () => {
    const result = render({ body: tableVariable('tooLong', 1) })
    expect(isTableLimitExceeded(result)).toBe(true)
    expect(JSON.parse(JSON.stringify(result))).toEqual({ body: '' })
  })

  describe.each([
    {
      limit: 'columns',
      body: tableVariable('tooWide', MAX_TABLE_VARIABLE_COLUMNS + 1),
    },
    { limit: 'rows', body: tableVariable('tooLong', 1) },
    { limit: 'bytes', body: tableVariable('tooBig', 1) },
    { limit: 'step budget', body: wide.repeat(3) },
  ])('over the $limit limit', ({ body }) => {
    it.each([false, true])(
      'logs and fails the step without sending (test run: %s)',
      async (testRun) => {
        const parameters = render({
          destinationEmail: 'recipient@open.gov.sg',
          subject: 'Subject',
          senderName: 'Sender',
          body: `Hello ${body}`,
        })
        const $ = makeGlobal(parameters, testRun)
        const send = testRun
          ? sendTransactionalEmail.testRun!($)
          : sendTransactionalEmail.run!($)

        const error = await send.catch((e) => e)
        expect(error).toBeInstanceOf(StepError)
        expect(getStepErrorKind(error)).toBe('config')
        expect($.http.post).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith(
          'Table variable failed to render',
          expect.objectContaining({ error: 'limit_exceeded' }),
        )
      },
    )
  })

  it('fails the step when a nested body field goes over the limit', async () => {
    const parameters = render({
      destinationEmail: 'recipient@open.gov.sg',
      subject: 'Subject',
      senderName: 'Sender',
      body: 'Plain text',
      nested: { body: tableVariable('tooLong', 1) },
    })
    const $ = makeGlobal(parameters, false)

    const error = await sendTransactionalEmail.run!($).catch((e) => e)
    expect(getStepErrorKind(error)).toBe('config')
    expect($.http.post).not.toHaveBeenCalled()
  })
})

/**
 * Business rules:
 * - Table variables are capped at 100 columns and 500 rows. All tables in one
 *   step share a 10 MB HTML budget. Over a cap, the step fails
 *   instead of exhausting memory or sending the email without the table.
 */
import { randomUUID } from 'crypto'

import { MAX_TABLE_VARIABLE_COLUMNS } from '@plumber/shared'
import type { IJSONObject } from '@plumber/types'
import { describe, expect, it } from 'vitest'

import computeParameters from '@/helpers/compute-parameters'
import { hexEncode } from '@/helpers/hex-encoding'
import ExecutionStep from '@/models/execution-step'

import sendTransactionalEmail from '../../actions/send-transactional-email'

const stepId = randomUUID()
const columns = Array.from({ length: MAX_TABLE_VARIABLE_COLUMNS }, (_, i) => ({
  id: `c${i}`,
  name: `Col ${i}`,
}))
// Each table renders about 3.8 MB of HTML, so two fit in the 10 MB budget.
const table = {
  rows: Array.from({ length: 300 }, () => ({ data: {} })),
  columns,
}
const executionSteps = [
  {
    stepId,
    dataOut: {
      table,
      spoof: {
        __type: 'table',
        data: table,
        selectedColumnIds: columns.map((c) => c.id),
        renderBudget: { bytes: 1e12 },
      },
    },
  } as unknown as ExecutionStep,
]
const tableVariable = `{{step.${stepId}.table|${hexEncode(
  `table:${columns.map((c) => c.id).join(',')}`,
)}}}`

function render(parameters: Record<string, unknown>) {
  return computeParameters(
    parameters as IJSONObject,
    executionSteps,
    sendTransactionalEmail.preprocessVariable,
  )
}

const countTables = (value: unknown) =>
  (JSON.stringify(value).match(/<table/g) ?? []).length

describe('send email table variables', () => {
  it('renders tables in the body until the step budget runs out', () => {
    expect(countTables(render({ body: tableVariable.repeat(3) }))).toBe(2)
  })

  it('shares the budget across body fields nested in arrays and objects', () => {
    const result = render({
      body: [tableVariable, tableVariable],
      nested: { body: tableVariable },
    })
    expect(countTables(result)).toBe(2)
  })

  it('does not render upstream data that resembles a table marker', () => {
    const result = render({ body: `{{step.${stepId}.spoof}}` })
    expect(countTables(result)).toBe(0)
  })
})

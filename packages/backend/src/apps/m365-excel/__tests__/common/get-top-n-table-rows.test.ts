import type { IGlobalVariable } from '@plumber/types'
import { describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'

import { getTopNTableRows } from '../../common/get-top-n-table-rows'
import type WorkbookSession from '../../common/workbook-session'

function makeSession(data: unknown): WorkbookSession {
  return {
    request: vi.fn().mockResolvedValue({ data }),
  } as unknown as WorkbookSession
}

const $ = {} as IGlobalVariable

describe('getTopNTableRows', () => {
  it('returns the header and data rows', async () => {
    const session = makeSession({
      rowCount: 2,
      rowIndex: 4,
      values: [['Name'], ['Alice']],
    })
    await expect(getTopNTableRows($, session, 'table-id', 10)).resolves.toEqual(
      { columns: ['Name'], rows: [['Alice']], headerSheetRowIndex: 4 },
    )
  })

  it('throws a config StepError when the range response is malformed', async () => {
    const session = makeSession({ rowCount: 1, rowIndex: 0 })
    const error = await getTopNTableRows($, session, 'table-id', 10).catch(
      (err: unknown) => err,
    )
    expect(error).toBeInstanceOf(StepError)
    expect(error).toMatchObject({ kind: 'config' })
  })

  it('throws a config StepError when the table has more than n rows', async () => {
    const session = makeSession({
      rowCount: 3,
      rowIndex: 0,
      values: [['Name'], ['Alice'], ['Bob']],
    })
    const error = await getTopNTableRows($, session, 'table-id', 1).catch(
      (err: unknown) => err,
    )
    expect(error).toBeInstanceOf(StepError)
    expect(error).toMatchObject({ kind: 'config' })
  })
})

import { describe, expect, it, vi } from 'vitest'

import { readCheckStepError, requestStepErrorFix } from '../step-error-fix'

describe('readCheckStepError', () => {
  it('keeps the user-facing error and drops http details', () => {
    expect(
      readCheckStepError({
        name: 'Column not found',
        solution: 'Check the column name.',
        details: { authorization: 'secret' },
      }),
    ).toEqual({
      errorName: 'Column not found',
      errorSolution: 'Check the column name.',
    })
  })

  it('uses a generic name when the error has no title', () => {
    expect(readCheckStepError({ status: 500 })).toEqual({
      errorName: 'We could not test this step',
    })
  })
})

describe('requestStepErrorFix', () => {
  it('rejects a response without a summary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { fixed: true, summary: ' ' } }),
      }),
    )

    await expect(
      requestStepErrorFix({
        stepId: '11111111-1111-4111-8111-111111111111',
        appName: 'Excel',
        appKey: 'm365-excel',
        stepKey: 'createTableRow',
        stepName: 'Create table row',
        errorName: 'Column not found',
      }),
    ).rejects.toThrow('AI could not fix this step')
    vi.unstubAllGlobals()
  })
})

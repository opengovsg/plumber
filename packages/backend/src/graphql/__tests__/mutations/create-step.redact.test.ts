import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ redactStepParameters: vi.fn() }))

vi.mock('@/apps', () => ({ default: {} }))

vi.mock(
  '@/helpers/redaction/redact-step-parameters',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('@/helpers/redaction/redact-step-parameters')
    >()),
    redactStepParameters: mocks.redactStepParameters,
  }),
)

import { redactVariables } from '@/graphql/mutations/create-step.redact'

describe('createStep redactVariables', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.redactStepParameters.mockReturnValue({ redacted: true })
  })

  it('hands input to the step redactor and puts the result back', () => {
    const input = { previousStepId: 'step-0', appKey: 'custom-api' }

    expect(redactVariables({ input })).toEqual({ input: { redacted: true } })
    expect(mocks.redactStepParameters).toHaveBeenCalledWith(input)
  })

  it('keeps every sibling variable', () => {
    const result = redactVariables({ input: {}, other: 'kept' })

    expect(result).toEqual({ input: { redacted: true }, other: 'kept' })
  })

  it.each([null, 'string', 42, [1, 2]])('passes through %j', (variables) => {
    expect(redactVariables(variables)).toBe(variables)
    expect(mocks.redactStepParameters).not.toHaveBeenCalled()
  })

  it('does not mutate the variables it was given', () => {
    const variables = { input: { previousStepId: 'step-0' } }

    redactVariables(variables)

    expect(variables).toEqual({ input: { previousStepId: 'step-0' } })
  })
})

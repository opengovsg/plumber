import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ redactUpdateStep: vi.fn() }))

vi.mock('../graphql-operations', () => ({
  OPERATION_REDACTIONS: { updateStep: mocks.redactUpdateStep },
}))

import { redactGraphqlVariables } from '../redact-graphql-variables'

describe('redactGraphqlVariables', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.redactUpdateStep.mockReturnValue({ input: 'redacted' })
  })

  it('applies the callback the operation declares', () => {
    const variables = { input: { id: 'step-1' } }

    expect(redactGraphqlVariables(['updateStep'], variables)).toEqual({
      input: 'redacted',
    })
    expect(mocks.redactUpdateStep).toHaveBeenCalledWith(variables)
  })

  it('passes through an operation that declares nothing', () => {
    const variables = { input: { id: 'step-1' } }

    expect(redactGraphqlVariables(['updateFlow'], variables)).toBe(variables)
    expect(mocks.redactUpdateStep).not.toHaveBeenCalled()
  })

  it('blanks the blob when the root fields are unknown', () => {
    expect(
      redactGraphqlVariables(undefined, { input: { secret: 'sk-live-1' } }),
    ).toBe('[redacted]')
    expect(mocks.redactUpdateStep).not.toHaveBeenCalled()
  })

  it('blanks the blob when no root field was stamped', () => {
    expect(redactGraphqlVariables([], { input: { secret: 'sk-live-1' } })).toBe(
      '[redacted]',
    )
  })

  it('blanks the blob for a multi-root-field operation', () => {
    expect(
      redactGraphqlVariables(['updateStep', 'createStep'], {
        input: { secret: 'sk-live-1' },
      }),
    ).toBe('[redacted]')
    expect(mocks.redactUpdateStep).not.toHaveBeenCalled()
  })

  it('blanks the blob when the callback throws', () => {
    mocks.redactUpdateStep.mockImplementation(() => {
      throw new Error('boom')
    })

    expect(
      redactGraphqlVariables(['updateStep'], {
        input: { secret: 'sk-live-1' },
      }),
    ).toBe('[redacted]')
  })

  it('does not mutate the variables it was given', () => {
    const variables = { input: { id: 'step-1' } }

    redactGraphqlVariables(['updateStep'], variables)

    expect(variables).toEqual({ input: { id: 'step-1' } })
  })
})

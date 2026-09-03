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

import { redactVariables } from '@/graphql/mutations/ai/create-flow-with-steps.redact'

describe('createFlowWithSteps redactVariables', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.redactStepParameters.mockImplementation((step) => ({
      redacted: step.key,
    }))
  })

  it('hands every step to the step redactor', () => {
    const result = redactVariables({
      input: {
        flowName: 'My flow',
        steps: [{ key: 'httpRequest' }, { key: 'plainAction' }],
      },
    })

    expect(result).toEqual({
      input: {
        flowName: 'My flow',
        steps: [{ redacted: 'httpRequest' }, { redacted: 'plainAction' }],
      },
    })
    expect(mocks.redactStepParameters).toHaveBeenCalledTimes(2)
  })

  it('keeps aiBuilderConfig, which carries no parameters', () => {
    const result = redactVariables({
      input: { aiBuilderConfig: { traceId: 'trace-1' }, steps: [] },
    })

    expect(result).toEqual({
      input: { aiBuilderConfig: { traceId: 'trace-1' }, steps: [] },
    })
  })

  it('passes through when steps is not an array', () => {
    const variables = { input: { steps: 'not-an-array' } }

    expect(redactVariables(variables)).toBe(variables)
    expect(mocks.redactStepParameters).not.toHaveBeenCalled()
  })

  it('passes through when there is no input object', () => {
    const variables = { notAnInput: 'x' }

    expect(redactVariables(variables)).toBe(variables)
  })

  it.each([null, 'string', 42, [1, 2]])('passes through %j', (variables) => {
    expect(redactVariables(variables)).toBe(variables)
  })

  it('does not mutate the variables it was given', () => {
    const variables = { input: { steps: [{ key: 'httpRequest' }] } }

    redactVariables(variables)

    expect(variables).toEqual({ input: { steps: [{ key: 'httpRequest' }] } })
  })
})

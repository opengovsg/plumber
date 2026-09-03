import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  redactHttpRequest: vi.fn(),
  redactNewSubmission: vi.fn(),
}))

vi.mock('@/apps', () => ({
  default: {
    'custom-api': {
      key: 'custom-api',
      actions: [
        { key: 'httpRequest', redactParams: mocks.redactHttpRequest },
        { key: 'plainAction' },
      ],
    },
    formsg: {
      key: 'formsg',
      triggers: [
        { key: 'newSubmission', redactParams: mocks.redactNewSubmission },
      ],
    },
  },
}))

import { isJsonObject, redactStepParameters } from '../redact-step-parameters'

const HEADERS = [{ key: 'Authorization', value: 'Bearer secret' }]
const REDACTED_HEADERS = [{ key: 'Authorization', value: '[redacted]' }]

describe('redactStepParameters', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.redactHttpRequest.mockReturnValue({
      customHeaders: REDACTED_HEADERS,
    })
  })

  it("applies an action's redactParams", () => {
    const result = redactStepParameters({
      id: 'step-1',
      appKey: 'custom-api',
      key: 'httpRequest',
      parameters: { customHeaders: HEADERS },
    })

    expect(result).toEqual({
      id: 'step-1',
      appKey: 'custom-api',
      key: 'httpRequest',
      parameters: { customHeaders: REDACTED_HEADERS },
    })
    expect(mocks.redactHttpRequest).toHaveBeenCalledWith({
      customHeaders: HEADERS,
    })
  })

  it("applies a trigger's redactParams", () => {
    mocks.redactNewSubmission.mockReturnValue({ redacted: true })

    const result = redactStepParameters({
      appKey: 'formsg',
      key: 'newSubmission',
      parameters: { formId: 'abc' },
    })

    expect(result).toEqual({
      appKey: 'formsg',
      key: 'newSubmission',
      parameters: { redacted: true },
    })
  })

  it('prefers stepKey over key, which dynamicAction needs', () => {
    const result = redactStepParameters({
      stepId: 'step-1',
      key: 'databricks-createTable',
      appKey: 'custom-api',
      stepKey: 'httpRequest',
      parameters: { customHeaders: HEADERS },
    })

    expect(result).toEqual({
      stepId: 'step-1',
      key: 'databricks-createTable',
      appKey: 'custom-api',
      stepKey: 'httpRequest',
      parameters: { customHeaders: REDACTED_HEADERS },
    })
  })

  it('passes through an unknown appKey', () => {
    const node = {
      appKey: 'no-such-app',
      key: 'httpRequest',
      parameters: { customHeaders: HEADERS },
    }

    expect(redactStepParameters(node)).toBe(node)
  })

  it('passes through an action that declares no redactParams', () => {
    const node = {
      appKey: 'custom-api',
      key: 'plainAction',
      parameters: { customHeaders: HEADERS },
    }

    expect(redactStepParameters(node)).toBe(node)
  })

  it('passes through a node with no appKey', () => {
    const node = { key: 'httpRequest', parameters: { customHeaders: HEADERS } }

    expect(redactStepParameters(node)).toBe(node)
  })

  it.each([null, 'string', 42, [1, 2]])('passes through %j', (node) => {
    expect(redactStepParameters(node)).toBe(node)
  })

  it('blanks parameters when redactParams throws', () => {
    mocks.redactHttpRequest.mockImplementation(() => {
      throw new Error('boom')
    })

    const result = redactStepParameters({
      appKey: 'custom-api',
      key: 'httpRequest',
      parameters: { customHeaders: HEADERS },
    })

    expect(result).toEqual({
      appKey: 'custom-api',
      key: 'httpRequest',
      parameters: '[redacted]',
    })
  })

  it('does not mutate the node it was given', () => {
    const node = {
      appKey: 'custom-api',
      key: 'httpRequest',
      parameters: { customHeaders: HEADERS },
    }

    redactStepParameters(node)

    expect(node.parameters.customHeaders).toEqual(HEADERS)
  })
})

describe('isJsonObject', () => {
  it.each([{}, { a: 1 }])('accepts %j', (value) => {
    expect(isJsonObject(value)).toBe(true)
  })

  it.each([null, undefined, 'string', 42, [1, 2]])('rejects %j', (value) => {
    expect(isJsonObject(value)).toBe(false)
  })
})

import type { IGlobalVariable } from '@plumber/types'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    error: mocks.error,
  },
}))

import { processFields, validateData } from '../../auth/decrypt-response'
import { HEX_ENCODED_FIELD_PREFIX } from '../../common/constants'

const MOCK_FLOW: NonNullable<IGlobalVariable['flow']> = {
  id: 'flow-1',
  name: 'test flow',
  hasFileProcessingActions: false,
  userId: 'user-1',
  isActive: true,
}

describe('processFields', () => {
  it('should process fields with whitespace, -, _', () => {
    const fields = {
      name: 'John Doe',
      email: 'john.doe@example.com',
      'field-email': 'john.doe@example.com',
      field_email: 'john.doe@example.com',
      'field email': 'john.doe@example.com',
    }
    const processedFields = processFields(fields)
    expect(processedFields).toEqual(fields)
  })

  it.each([
    'field / Email',
    'field.email',
    'field&email',
    'field%email',
    'field$email',
    'field@email',
    'field^email',
    'field!email',
    'field(email)',
  ])('should hex encode fields with special characters', (field: string) => {
    const fields = {
      name: 'John Doe',
      [field]: 'john.doe@example.com',
    }
    const hexEncodedField = `${HEX_ENCODED_FIELD_PREFIX}${Buffer.from(
      field,
    ).toString('hex')}`
    const processedFields = processFields(fields)
    expect(processedFields).toEqual({
      name: 'John Doe',
      [hexEncodedField]: 'john.doe@example.com',
    })
  })
})

describe('validateData', () => {
  beforeEach(() => {
    mocks.error.mockClear()
  })

  it('returns the parsed data when it passes schema validation', () => {
    const data = {
      updatedBy: { email: 'user@example.com', name: 'John Doe' },
      fields: { name: 'value' },
    }

    const result = validateData(data, MOCK_FLOW, 'gathersg')

    expect(result).toEqual(data)
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('throws and logs a potential infinite loop when data fails schema validation', () => {
    const data = { type: 'case', uuid: 'case-uuid-1' }

    expect(() => validateData(data, MOCK_FLOW, 'gathersg')).toThrow(
      'GatherSG: potential infinite loop! Webhook not triggered by user!',
    )

    expect(mocks.error).toHaveBeenCalledWith(
      'GatherSG: potential infinite loop! Webhook not triggered by user! flowId: flow-1. app: gathersg. case type: case. case uuid: case-uuid-1',
      {
        event: 'ownself-gather-potential-infinite-loop',
        flowId: MOCK_FLOW.id,
        isFlowActive: MOCK_FLOW.isActive,
      },
    )
  })

  it('handles missing case type/uuid in the log message when data is undefined', () => {
    expect(() => validateData(undefined, MOCK_FLOW, 'gathersg')).toThrow(
      'GatherSG: potential infinite loop! Webhook not triggered by user!',
    )

    expect(mocks.error).toHaveBeenCalledWith(
      'GatherSG: potential infinite loop! Webhook not triggered by user! flowId: flow-1. app: gathersg. case type: undefined. case uuid: undefined',
      expect.objectContaining({
        event: 'ownself-gather-potential-infinite-loop',
      }),
    )
  })
})

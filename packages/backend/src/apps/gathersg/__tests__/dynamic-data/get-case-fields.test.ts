import type { IGlobalVariable } from '@plumber/types'

import { describe, expect, it, vi } from 'vitest'

import getCaseFields from '../../dynamic-data/get-case-fields'

const MOCK_CASE_TYPE_UUID = 'case-type-uuid-123456'

describe('getCaseFields', () => {
  it('maps GatherSG field types to string/number/email, filtering out unsupported fields', async () => {
    const httpGet = vi.fn().mockResolvedValue({
      data: {
        data: {
          uuid: MOCK_CASE_TYPE_UUID,
          name: 'Sample case type',
          version: 1,
          fields: [
            { name: 'Text', type: 'text', optional: true },
            { name: 'Number', type: 'number', optional: true },
            { name: 'Money', type: 'money', optional: true },
            { name: 'NRIC', type: 'nric', optional: true },
            { name: 'Email', type: 'email', optional: true },
            { name: 'Dropdown', type: 'dropdown', optional: true },
            { name: 'Attachment', type: 'attachment', optional: true },
          ],
        },
      },
    })

    const $ = {
      step: {
        parameters: {
          caseType: MOCK_CASE_TYPE_UUID,
        },
      },
      http: {
        get: httpGet,
      },
    } as unknown as IGlobalVariable

    const result = await getCaseFields.run($)

    expect(result).toEqual({
      data: [
        { name: 'Text', value: 'Text', type: 'string' },
        { name: 'Number', value: 'Number', type: 'number' },
        { name: 'Money', value: 'Money', type: 'number' },
        { name: 'NRIC', value: 'NRIC', type: 'string' },
        { name: 'Email', value: 'Email', type: 'email' },
      ],
    })
  })
})

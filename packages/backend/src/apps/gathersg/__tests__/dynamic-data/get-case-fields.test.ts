import type { IGlobalVariable } from '@plumber/types'

import { describe, expect, it, vi } from 'vitest'

import { getTestExecutionSteps } from '@/helpers/get-test-execution-steps'

import getCaseFields from '../../dynamic-data/get-case-fields'

vi.mock('@/helpers/get-test-execution-steps', () => ({
  getTestExecutionSteps: vi.fn(),
}))

const MOCK_CASE_TYPE_UUID = 'case-type-uuid-123456'

describe('getCaseFields', () => {
  it('maps GatherSG field types to string/number/email/dropdown/checkbox/radio, filtering out unsupported fields', async () => {
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
            { name: 'Checkbox', type: 'checkbox', optional: true },
            { name: 'Radio', type: 'radio', optional: true },
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
        { name: 'Dropdown', value: 'Dropdown', type: 'dropdown' },
        { name: 'Checkbox', value: 'Checkbox', type: 'checkbox' },
        { name: 'Radio', value: 'Radio', type: 'radio' },
      ],
    })
  })

  it('returns empty data when the caseUuid variable resolves to empty', async () => {
    const httpGet = vi.fn()
    vi.mocked(getTestExecutionSteps).mockResolvedValue([])

    const $ = {
      flow: { id: 'flow-id-123' },
      step: {
        parameters: {
          caseUuid: '{{step.aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.data.uuid}}',
        },
      },
      http: { get: httpGet },
    } as unknown as IGlobalVariable

    const result = await getCaseFields.run($)

    expect(result).toEqual({ data: [] })
    expect(httpGet).not.toHaveBeenCalled()
  })

  it('resolves a case ref before loading fields', async () => {
    const caseUuid = '1234567890abcdefghijkl'
    const httpPost = vi.fn().mockResolvedValue({
      data: { total: 1, data: [{ uuid: caseUuid }] },
    })
    const httpGet = vi
      .fn()
      .mockResolvedValueOnce({
        data: { data: { type: { uuid: 'case-type-uuid' } } },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            fields: [{ name: 'Text', type: 'text', optional: true }],
          },
        },
      })

    const $ = {
      step: { parameters: { caseUuid: '261007-00001' } },
      http: { get: httpGet, post: httpPost },
    } as unknown as IGlobalVariable

    const result = await getCaseFields.run($)

    expect(httpPost).toHaveBeenCalledWith('/cases/search', {
      caseRefs: ['261007-00001'],
      page: 1,
      size: 10,
    })
    expect(httpGet).toHaveBeenCalledWith('/cases/:caseUuid', {
      urlPathParams: { caseUuid },
    })
    expect(result.data).toEqual([
      { name: 'Text', value: 'Text', type: 'string' },
    ])
  })

  it('returns an error when a case ref matches more than one case', async () => {
    const httpPost = vi.fn().mockResolvedValue({
      data: {
        data: [
          { uuid: '1234567890abcdefghijkl' },
          { uuid: 'abcdefghijklmnopqrstuv' },
        ],
      },
    })
    const httpGet = vi.fn()
    const $ = {
      step: { parameters: { caseUuid: '261007-00001' } },
      http: { get: httpGet, post: httpPost },
    } as unknown as IGlobalVariable

    const result = await getCaseFields.run($)

    expect(result).toEqual({
      data: [],
      error: {
        message: 'More than one case found for case ref 261007-00001',
      },
    })
    expect(httpGet).not.toHaveBeenCalled()
  })
})

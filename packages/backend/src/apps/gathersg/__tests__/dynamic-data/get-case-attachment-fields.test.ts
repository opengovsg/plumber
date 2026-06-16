import type { IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import getCaseAttachmentFields from '../../dynamic-data/get-case-attachment-fields'

const MOCK_CASE_UUID = '1234567890abcdefghijkl'

const mocks = vi.hoisted(() => ({
  httpGet: vi.fn(),
}))

describe('getCaseAttachmentFields', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      flow: { id: 'flow-id-123' },
      step: { parameters: { caseUuid: MOCK_CASE_UUID } },
      http: { get: mocks.httpGet } as unknown as IGlobalVariable['http'],
    } as unknown as IGlobalVariable

    // 1st call: GET /cases/:caseUuid -> case type uuid
    mocks.httpGet.mockResolvedValueOnce({
      data: { data: { type: { uuid: 'case-type-uuid' } } },
    })
    // 2nd call: GET /caseTypes/:caseTypeUuid -> fields
    mocks.httpGet.mockResolvedValueOnce({
      data: {
        data: {
          name: 'My Case Type',
          fields: [
            { name: 'full_name', type: 'string', optional: false },
            { name: 'photos', type: 'attachment', optional: true },
            { name: 'documents', type: 'attachment', optional: true },
          ],
        },
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns only attachment-type fields', async () => {
    const result = await getCaseAttachmentFields.run($)
    expect(result).toEqual({
      data: [
        { name: 'photos', value: 'photos' },
        { name: 'documents', value: 'documents' },
      ],
    })
  })

  it('returns empty data when no caseUuid', async () => {
    $.step.parameters.caseUuid = ''
    const result = await getCaseAttachmentFields.run($)
    expect(result).toEqual({ data: [] })
  })
})

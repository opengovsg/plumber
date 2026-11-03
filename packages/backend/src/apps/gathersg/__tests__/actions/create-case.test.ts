import type { IGlobalVariable } from '@plumber/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import app from '../../..'
import { makeHttpError } from '../../../../../test/utils/make-http-error'
import createCaseAction from '../../actions/create-case'

const MOCK_CASE_TYPE_UUID = 'case-type-uuid-1'

describe('create case', () => {
  let $: IGlobalVariable
  let httpGet: ReturnType<typeof vi.fn>
  let httpPost: ReturnType<typeof vi.fn>

  beforeEach(() => {
    httpGet = vi.fn(async () => ({
      data: {
        data: {
          uuid: MOCK_CASE_TYPE_UUID,
          name: 'Feedback',
          version: 1,
          fields: [{ name: 'Email', type: 'email', optional: false }],
        },
      },
    }))
    httpPost = vi.fn(async () => ({
      data: { data: { caseRef: '261007-00001', uuid: 'case-uuid-1' } },
    }))

    $ = {
      app,
      auth: { set: vi.fn(), data: { apiKey: 'sample-api-key' } },
      step: {
        id: 'step-id-123',
        appKey: 'gathersg',
        position: 2,
        parameters: {
          caseType: MOCK_CASE_TYPE_UUID,
          caseFields: [
            { field: 'Email', fieldType: 'email', value: 'a@example.com' },
          ],
        },
      },
      http: {
        get: httpGet,
        post: httpPost,
      } as unknown as IGlobalVariable['http'],
      setActionItem: vi.fn(),
    } as unknown as IGlobalVariable
  })

  it('creates a case', async () => {
    await createCaseAction.run($)

    expect($.setActionItem).toHaveBeenCalledWith({
      raw: { data: { caseRef: '261007-00001', uuid: 'case-uuid-1' } },
    })
  })

  it('tags an invalid field value as config', async () => {
    $.step.parameters.caseFields = [
      { field: 'Email', fieldType: 'email', value: 'not-an-email' },
    ]

    await expect(createCaseAction.run($)).rejects.toMatchObject({
      kind: 'config',
      message: expect.stringContaining(
        'caseFields: Invalid email for field: Email',
      ),
    })
    expect(httpPost).not.toHaveBeenCalled()
  })

  it('tags an empty case type as config', async () => {
    $.step.parameters.caseType = ''

    await expect(createCaseAction.run($)).rejects.toMatchObject({
      kind: 'config',
      message: expect.stringContaining('caseType: Case type empty'),
    })
  })

  it('tags an unexpected create response as third-party', async () => {
    httpPost.mockResolvedValueOnce({ data: { data: { uuid: 'case-uuid-1' } } })

    await expect(createCaseAction.run($)).rejects.toMatchObject({
      kind: 'third-party',
      message: expect.stringContaining('"name":"data:'),
    })
  })

  it('tags a 422 INVALID_INPUT from Gather as config', async () => {
    httpPost.mockRejectedValueOnce(
      makeHttpError({
        status: 422,
        data: {
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid input',
            details: { fields: ['Email'] },
          },
        },
      }),
    )

    await expect(createCaseAction.run($)).rejects.toMatchObject({
      kind: 'config',
      message: expect.stringContaining('Invalid or missing values for: Email'),
    })
  })

  it('tags a 504 from Gather as third-party', async () => {
    httpPost.mockRejectedValueOnce(
      makeHttpError({ status: 504, data: '<html>Gateway Timeout</html>' }),
    )

    await expect(createCaseAction.run($)).rejects.toMatchObject({
      kind: 'third-party',
    })
  })

  it('tags an unexpected case type response as internal', async () => {
    httpGet.mockResolvedValueOnce({ data: {} })

    await expect(createCaseAction.run($)).rejects.toMatchObject({
      kind: 'internal',
      message: expect.stringContaining('An error occurred:'),
    })
  })
})

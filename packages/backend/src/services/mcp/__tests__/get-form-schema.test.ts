import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getFormSchemaService } from '../get-form-schema'

vi.mock('axios')

const FORM_ID = '654ab1234abc1a012345f1e0'

function mockForm(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      form: {
        _id: FORM_ID,
        title: 'Workshop Registration',
        responseMode: 'encrypt',
        publicKey: 'some-public-key',
        form_fields: [] as unknown[],
        ...overrides,
      },
    },
  }
}

describe('getFormSchemaService', () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockReset()
  })

  describe('input parsing (SSRF safety)', () => {
    it('fetches against the prod API for a bare form id', async () => {
      vi.mocked(axios.get).mockResolvedValue(mockForm())

      const result = await getFormSchemaService(FORM_ID)

      expect(vi.mocked(axios.get)).toHaveBeenCalledWith(
        `https://form.gov.sg/api/v3/forms/${FORM_ID}`,
        expect.anything(),
      )
      expect(result).toMatchObject({ formId: FORM_ID, env: 'prod' })
    })

    it('fetches against the prod API for a share URL', async () => {
      vi.mocked(axios.get).mockResolvedValue(mockForm())

      await getFormSchemaService(`https://form.gov.sg/${FORM_ID}`)

      expect(vi.mocked(axios.get)).toHaveBeenCalledWith(
        `https://form.gov.sg/api/v3/forms/${FORM_ID}`,
        expect.anything(),
      )
    })

    it('fetches against the staging API for a staging admin URL', async () => {
      vi.mocked(axios.get).mockResolvedValue(mockForm())

      const result = await getFormSchemaService(
        `https://staging.form.gov.sg/admin/form/${FORM_ID}`,
      )

      expect(vi.mocked(axios.get)).toHaveBeenCalledWith(
        `https://staging.form.gov.sg/api/v3/forms/${FORM_ID}`,
        expect.anything(),
      )
      expect(result).toMatchObject({ env: 'staging' })
    })

    it('never fetches a non-form.gov.sg URL', async () => {
      const result = await getFormSchemaService(
        `https://evil.example.com/${FORM_ID}`,
      )

      expect(vi.mocked(axios.get)).not.toHaveBeenCalled()
      expect(result).toEqual({ error: 'Invalid form url' })
    })

    it('rejects a URL whose trailing 24 chars are not a hex form id', async () => {
      const result = await getFormSchemaService(
        'https://form.gov.sg/admin/form/not-a-valid-hex-form-id!',
      )

      expect(vi.mocked(axios.get)).not.toHaveBeenCalled()
      expect(result).toEqual({ error: 'Invalid form id' })
    })

    it('rejects inputs shorter than a form id', async () => {
      const result = await getFormSchemaService('abc123')

      expect(vi.mocked(axios.get)).not.toHaveBeenCalled()
      expect(result).toEqual({ error: 'Invalid form id' })
    })
  })

  describe('field mapping', () => {
    it('maps wireable fields with answer/answerArray variable paths', async () => {
      vi.mocked(axios.get).mockResolvedValue(
        mockForm({
          form_fields: [
            {
              _id: 'f1',
              title: 'Full name',
              fieldType: 'textfield',
              required: true,
            },
            {
              _id: 'f2',
              title: 'Sessions attending',
              fieldType: 'checkbox',
              required: false,
              fieldOptions: ['AM', 'PM'],
            },
          ],
        }),
      )

      const result = await getFormSchemaService(FORM_ID)

      expect(result).toMatchObject({
        fields: [
          {
            id: 'f1',
            title: 'Full name',
            fieldType: 'textfield',
            required: true,
            answerType: 'answer',
            variablePath: 'fields.f1.answer',
          },
          {
            id: 'f2',
            answerType: 'answerArray',
            variablePath: 'fields.f2.answerArray',
            options: ['AM', 'PM'],
          },
        ],
      })
    })

    it('skips non-wireable fields (section/statement/image/children)', async () => {
      vi.mocked(axios.get).mockResolvedValue(
        mockForm({
          form_fields: [
            { _id: 'f1', title: 'Header', fieldType: 'section' },
            { _id: 'f2', title: 'Info', fieldType: 'statement' },
            { _id: 'f3', title: 'Logo', fieldType: 'image' },
            { _id: 'f4', title: 'Child', fieldType: 'children' },
            { _id: 'f5', title: 'Email', fieldType: 'email' },
          ],
        }),
      )

      const result = await getFormSchemaService(FORM_ID)

      expect(result).toMatchObject({ fields: [{ id: 'f5' }] })
      expect((result as { fields: unknown[] }).fields).toHaveLength(1)
    })

    it('caps options and reports the truncated count', async () => {
      vi.mocked(axios.get).mockResolvedValue(
        mockForm({
          form_fields: [
            {
              _id: 'f1',
              title: 'Country',
              fieldType: 'dropdown',
              fieldOptions: Array.from({ length: 25 }, (_, i) => `Option ${i}`),
            },
          ],
        }),
      )

      const result = await getFormSchemaService(FORM_ID)

      const field = (result as { fields: any[] }).fields[0]
      expect(field.options).toHaveLength(10)
      expect(field.optionsTruncated).toBe(15)
    })

    it('maps table columns and myInfo attributes', async () => {
      vi.mocked(axios.get).mockResolvedValue(
        mockForm({
          form_fields: [
            {
              _id: 'f1',
              title: 'Attendees',
              fieldType: 'table',
              columns: [
                { _id: 'c1', title: 'Name' },
                { _id: 'c2', title: 'Role' },
              ],
            },
            {
              _id: 'f2',
              title: 'NRIC',
              fieldType: 'nric',
              myInfo: { attr: 'nric' },
            },
          ],
        }),
      )

      const result = await getFormSchemaService(FORM_ID)

      expect(result).toMatchObject({
        fields: [
          {
            id: 'f1',
            answerType: 'answerArray',
            columns: [
              { id: 'c1', title: 'Name' },
              { id: 'c2', title: 'Role' },
            ],
          },
          { id: 'f2', myInfoAttr: 'nric' },
        ],
      })
    })
  })

  describe('warnings', () => {
    it('warns when the form is not storage mode', async () => {
      vi.mocked(axios.get).mockResolvedValue(
        mockForm({ publicKey: undefined, responseMode: 'email' }),
      )

      const result = await getFormSchemaService(FORM_ID)

      expect(result).toMatchObject({
        isStorageMode: false,
        warnings: [expect.stringContaining('not a storage mode form')],
      })
    })

    it('warns when the form is MRF', async () => {
      vi.mocked(axios.get).mockResolvedValue(
        mockForm({
          responseMode: 'multirespondent',
          workflow: [{ _id: 'step1', edit: [], workflow_type: 'static' }],
        }),
      )

      const result = await getFormSchemaService(FORM_ID)

      expect(result).toMatchObject({
        isMrf: true,
        warnings: [expect.stringContaining('multi-respondent')],
      })
    })

    it('does not warn when responseMode is multirespondent but the workflow was never set up', async () => {
      vi.mocked(axios.get).mockResolvedValue(
        mockForm({ responseMode: 'multirespondent', workflow: [] }),
      )

      const result = await getFormSchemaService(FORM_ID)

      expect(result).toMatchObject({
        isMrf: false,
        warnings: [],
      })
    })
  })

  describe('fetch errors returned as data', () => {
    it('reports a non-public form (404 with isPageFound)', async () => {
      vi.mocked(axios.get).mockRejectedValue({
        message: 'Request failed',
        response: { status: 404, data: { isPageFound: true } },
      })

      const result = await getFormSchemaService(FORM_ID)

      expect(result).toEqual({
        error: expect.stringContaining('not public'),
      })
    })

    it('reports a nonexistent form (plain 404)', async () => {
      vi.mocked(axios.get).mockRejectedValue({
        message: 'Request failed',
        response: { status: 404, data: {} },
      })

      const result = await getFormSchemaService(FORM_ID)

      expect(result).toEqual({
        error: expect.stringContaining('does not exist'),
      })
    })

    it('reports a generic failure for network errors', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('ECONNRESET'))

      const result = await getFormSchemaService(FORM_ID)

      expect(result).toEqual({
        error: expect.stringContaining('Unable to fetch form'),
      })
    })
  })
})

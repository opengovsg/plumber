// you need to import this to make the toPlumberFormat method available
import '@/types/luxon-extensions'

import type { IGlobalVariable } from '@plumber/types'

import { describe, expect, it, vi } from 'vitest'

import { processResponsesV3 } from '../../auth/helpers/process-v3-responses'

const mocks = vi.hoisted(() => ({
  fetchFormSchema: vi.fn(),
  loggerError: vi.fn(),
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    error: mocks.loggerError,
  },
}))

vi.mock('../../triggers/new-submission/fetch-form-schema', () => ({
  fetchFormSchema: mocks.fetchFormSchema,
}))

function makeFormSchema(
  fields: Array<{
    _id: string
    title: string
    fieldType: string
    columns?: Array<{ title: string; _id: string }>
  }>,
) {
  return {
    form: {
      form_fields: fields,
    },
  }
}

describe('processResponsesV3', () => {
  const $ = {} as IGlobalVariable

  describe('field type mapping', () => {
    it('maps a simple text field using catch-all', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          { _id: 'field1', title: 'Your name', fieldType: 'textfield' },
        ]),
      )

      const result = await processResponsesV3($, 'formId', {
        field1: { fieldType: 'textfield', answer: 'John' },
      })

      expect(result).toEqual([
        {
          _id: 'field1',
          fieldType: 'textfield',
          question: 'Your name',
          answer: 'John',
        },
      ])
    })

    it('maps checkbox fields with answerArray from answer.value', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          { _id: 'cb1', title: 'Hobbies', fieldType: 'checkbox' },
        ]),
      )

      const result = await processResponsesV3($, 'formId', {
        cb1: {
          fieldType: 'checkbox',
          answer: { value: ['reading', 'gaming'] },
        },
      })

      expect(result).toEqual([
        {
          _id: 'cb1',
          fieldType: 'checkbox',
          question: 'Hobbies',
          answerArray: ['reading', 'gaming'],
        },
      ])
    })

    it.each(['radiobutton', 'email', 'mobile'])(
      'maps %s fields with answer from answer.value',
      async (fieldType) => {
        mocks.fetchFormSchema.mockResolvedValueOnce(
          makeFormSchema([{ _id: 'f1', title: 'Field', fieldType }]),
        )

        const result = await processResponsesV3($, 'formId', {
          f1: { fieldType, answer: { value: 'test-value' } },
        })

        expect(result).toEqual([
          {
            _id: 'f1',
            fieldType,
            question: 'Field',
            answer: 'test-value',
          },
        ])
      },
    )

    it('maps signature fields with answerArray from answer.value', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          { _id: 'sig1', title: 'Sign here', fieldType: 'signature' },
        ]),
      )

      const result = await processResponsesV3($, 'formId', {
        sig1: {
          fieldType: 'signature',
          answer: { type: 'draw', value: [1.1, 1.2] },
        },
      })

      expect(result).toEqual([
        {
          _id: 'sig1',
          fieldType: 'signature',
          question: 'Sign here',
          answerArray: [1.1, 1.2],
        },
      ])
    })

    it('maps address fields into ordered answerArray', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          { _id: 'addr1', title: 'Address', fieldType: 'address' },
        ]),
      )

      const result = await processResponsesV3($, 'formId', {
        addr1: {
          fieldType: 'address',
          answer: {
            addressSubFields: {
              blockNumber: '51',
              streetName: 'Bras Basah Road',
              buildingName: 'Lazada One',
              levelNumber: '08',
              unitNumber: '888',
              postalCode: '189554',
            },
          },
        },
      })

      expect(result).toEqual([
        {
          _id: 'addr1',
          fieldType: 'address',
          question: 'Address',
          answerArray: [
            '51',
            'Bras Basah Road',
            'Lazada One',
            '08',
            '888',
            '189554',
          ],
        },
      ])
    })

    it('handles address with missing addressSubFields gracefully', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          { _id: 'addr1', title: 'Address', fieldType: 'address' },
        ]),
      )

      const result = await processResponsesV3($, 'formId', {
        addr1: {
          fieldType: 'address',
          answer: {},
        },
      })

      expect(result).toEqual([
        {
          _id: 'addr1',
          fieldType: 'address',
          question: 'Address',
          answerArray: [
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
          ],
        },
      ])
    })

    it('maps attachment fields with answer from answer.answer', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          { _id: 'att1', title: 'Upload file', fieldType: 'attachment' },
        ]),
      )

      const result = await processResponsesV3($, 'formId', {
        att1: {
          fieldType: 'attachment',
          answer: {
            hasBeenScanned: true,
            answer: 'document.pdf',
            md5Hash: 'abc123',
          },
        },
      })

      expect(result).toEqual([
        {
          _id: 'att1',
          fieldType: 'attachment',
          question: 'Upload file',
          answer: 'document.pdf',
        },
      ])
    })
  })

  describe('table fields', () => {
    it('maps table rows from objects to arrays using Object.values', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          {
            _id: 'tbl1',
            title: 'Items',
            fieldType: 'table',
            columns: [
              { title: 'Name', _id: 'col1' },
              { title: 'Qty', _id: 'col2' },
            ],
          },
        ]),
      )

      const result = await processResponsesV3($, 'formId', {
        tbl1: {
          fieldType: 'table',
          answer: [
            { col1: 'Apple', col2: '3' },
            { col1: 'Banana', col2: '5' },
          ],
        },
      })

      expect(result).toEqual([
        {
          _id: 'tbl1',
          fieldType: 'table',
          question: 'Items (Name, Qty)',
          answerArray: [
            ['Apple', '3'],
            ['Banana', '5'],
          ],
        },
      ])
    })

    it('escapes commas in column titles', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          {
            _id: 'tbl1',
            title: 'Data',
            fieldType: 'table',
            columns: [
              { title: 'First, Last', _id: 'col1' },
              { title: 'Age', _id: 'col2' },
            ],
          },
        ]),
      )

      const result = await processResponsesV3($, 'formId', {
        tbl1: {
          fieldType: 'table',
          answer: [{ col1: 'John Doe', col2: '30' }],
        },
      })

      expect(result[0].question).toBe('Data (First  Last, Age)')
    })

    it('does not append columns to question if schema has no columns', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([{ _id: 'tbl1', title: 'Items', fieldType: 'table' }]),
      )

      const result = await processResponsesV3($, 'formId', {
        tbl1: {
          fieldType: 'table',
          answer: [{ col1: 'Apple' }],
        },
      })

      expect(result[0].question).toBe('Items')
    })
  })

  describe('question fallback', () => {
    it('falls back to "Question N" when form schema has no matching field', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(makeFormSchema([]))

      const result = await processResponsesV3($, 'formId', {
        unknown1: { fieldType: 'textfield', answer: 'hello' },
        unknown2: { fieldType: 'textfield', answer: 'world' },
      })

      expect(result[0].question).toBe('Question 1')
      expect(result[1].question).toBe('Question 2')
    })
  })

  describe('form schema fetch failure', () => {
    it('logs error and falls back to question numbers when schema fetch fails', async () => {
      mocks.fetchFormSchema.mockRejectedValueOnce(new Error('Network error'))

      const result = await processResponsesV3($, 'formId', {
        field1: { fieldType: 'textfield', answer: 'test' },
      })

      expect(mocks.loggerError).toHaveBeenCalledWith(
        'Unable to fetch form schema',
        expect.objectContaining({
          event: 'formsg-unable-to-fetch-form-schema',
          formId: 'formId',
        }),
      )
      expect(result).toEqual([
        {
          _id: 'field1',
          fieldType: 'textfield',
          question: 'Question 1',
          answer: 'test',
        },
      ])
    })
  })

  describe('date fields', () => {
    it('converts DD/MM/YYYY to DD MMM YYYY format', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          { _id: 'dt1', title: 'Date of birth', fieldType: 'date' },
        ]),
      )

      const result = await processResponsesV3($, 'formId', {
        dt1: { fieldType: 'date', answer: '29/03/2026' },
      })

      expect(result[0]).toMatchObject({
        _id: 'dt1',
        fieldType: 'date',
        question: 'Date of birth',
        answer: '29 Mar 2026',
      })
    })

    it('should pad single digit dates with 0 in front', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          { _id: 'dt1', title: 'Date of birth', fieldType: 'date' },
        ]),
      )

      const result = await processResponsesV3($, 'formId', {
        dt1: { fieldType: 'date', answer: '01/03/2026' },
      })

      expect(result[0]).toMatchObject({
        _id: 'dt1',
        fieldType: 'date',
        question: 'Date of birth',
        answer: '01 Mar 2026',
      })
    })

    it('should use Sep not Sept for September', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          { _id: 'dt1', title: 'Date of birth', fieldType: 'date' },
        ]),
      )

      const result = await processResponsesV3($, 'formId', {
        dt1: { fieldType: 'date', answer: '01/09/2026' },
      })

      expect(result[0]).toMatchObject({
        _id: 'dt1',
        fieldType: 'date',
        question: 'Date of birth',
        answer: '01 Sep 2026',
      })
    })

    it('uses Question N fallback when field not in schema', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(makeFormSchema([]))

      const result = await processResponsesV3($, 'formId', {
        dt1: { fieldType: 'date', answer: '01/01/2025' },
      })

      expect(result[0].question).toBe('Question 1')
      expect(result[0].answer).toBe('01 Jan 2025')
    })
  })

  describe('multiple fields', () => {
    it('processes mixed field types in order', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          { _id: 'f1', title: 'Name', fieldType: 'textfield' },
          { _id: 'f2', title: 'Email', fieldType: 'email' },
          { _id: 'f3', title: 'Agree?', fieldType: 'checkbox' },
        ]),
      )

      const result = await processResponsesV3($, 'formId', {
        f1: { fieldType: 'textfield', answer: 'John' },
        f2: { fieldType: 'email', answer: { value: 'john@example.com' } },
        f3: { fieldType: 'checkbox', answer: { value: ['Yes'] } },
      })

      expect(result).toHaveLength(3)
      expect(result[0]).toMatchObject({ _id: 'f1', answer: 'John' })
      expect(result[1]).toMatchObject({
        _id: 'f2',
        answer: 'john@example.com',
      })
      expect(result[2]).toMatchObject({
        _id: 'f3',
        answerArray: ['Yes'],
      })
    })
  })
})

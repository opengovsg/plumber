// you need to import this to make the toPlumberFormat method available
import '@/types/luxon-extensions'
import type {
  AnswerV4,
  FieldResponseV4,
  FieldType,
  FormFieldsV3,
} from '@opengovsg/formsg-sdk'
// value imports from the SDK must use the adapters subpath — the package
// root's CJS entry only exposes the default factory at runtime
import { adaptV3ToV4 } from '@opengovsg/formsg-sdk/adapters'
import type { IGlobalVariable } from '@plumber/types'
import { describe, expect, it, vi } from 'vitest'

import { processResponsesV3 } from '../../auth/helpers/process-v3-responses'
import { processResponsesV4 } from '../../auth/helpers/process-v4-responses'
import {
  exampleV4Submission,
  makeExampleV4FormSchema,
} from './v4-submission.mock'

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

// question and provenance are part of every v4 response, but processResponsesV4
// derives the question from the form schema instead
function v4Response(fieldType: FieldType, answer: unknown): FieldResponseV4 {
  return {
    fieldType,
    answer: answer as AnswerV4,
    question: 'ignored - question comes from the form schema',
    provenance: { submittedAt: '2026-03-29T00:00:00.000Z' },
  }
}

describe('processResponsesV4', () => {
  const $ = {} as IGlobalVariable

  describe('field type mapping', () => {
    it('maps a simple text field using catch-all', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          { _id: 'field1', title: 'Your name', fieldType: 'textfield' },
        ]),
      )

      const result = await processResponsesV4($, 'formId', {
        field1: v4Response('textfield', { value: 'John' }),
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

    it('maps yes_no fields using catch-all', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([{ _id: 'yn1', title: 'Agree?', fieldType: 'yes_no' }]),
      )

      const result = await processResponsesV4($, 'formId', {
        yn1: v4Response('yes_no', { value: 'Yes' }),
      })

      expect(result).toEqual([
        {
          _id: 'yn1',
          fieldType: 'yes_no',
          question: 'Agree?',
          answer: 'Yes',
        },
      ])
    })

    it('maps checkbox fields with answerArray from answer.value', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          { _id: 'cb1', title: 'Hobbies', fieldType: 'checkbox' },
        ]),
      )

      const result = await processResponsesV4($, 'formId', {
        cb1: v4Response('checkbox', {
          value: ['reading', 'gaming'],
          othersInput: 'hiking',
        }),
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

    it('replaces the internal others marker with "Others: <othersInput>"', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          { _id: 'cb1', title: 'Hobbies', fieldType: 'checkbox' },
        ]),
      )

      const result = await processResponsesV4($, 'formId', {
        cb1: v4Response('checkbox', {
          value: ['reading', '!!FORMSG_INTERNAL_CHECKBOX_OTHERS_VALUE!!'],
          othersInput: 'custom hobby',
        }),
      })

      expect(result).toEqual([
        {
          _id: 'cb1',
          fieldType: 'checkbox',
          question: 'Hobbies',
          answerArray: ['reading', 'Others: custom hobby'],
        },
      ])
    })

    it('maps mobile fields with answer from answer.value', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([{ _id: 'f1', title: 'Field', fieldType: 'mobile' }]),
      )

      const result = await processResponsesV4($, 'formId', {
        f1: v4Response('mobile', { value: 'test-value' }),
      })

      expect(result).toEqual([
        {
          _id: 'f1',
          fieldType: 'mobile',
          question: 'Field',
          answer: 'test-value',
        },
      ])
    })

    it('includes signature for a verified email field', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([{ _id: 'f1', title: 'Field', fieldType: 'email' }]),
      )

      const result = await processResponsesV4($, 'formId', {
        f1: v4Response('email', {
          value: 'test-value',
          signature: 'some-signature',
        }),
      })

      expect(result).toEqual([
        {
          _id: 'f1',
          fieldType: 'email',
          question: 'Field',
          answer: 'test-value',
          signature: 'some-signature',
        },
      ])
    })

    it('does not include signature for an unverified email field', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([{ _id: 'f1', title: 'Field', fieldType: 'email' }]),
      )

      const result = await processResponsesV4($, 'formId', {
        f1: v4Response('email', { value: 'test-value' }),
      })

      expect(result).toEqual([
        {
          _id: 'f1',
          fieldType: 'email',
          question: 'Field',
          answer: 'test-value',
        },
      ])
    })

    it('does not include signature for a mobile field even if present', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([{ _id: 'f1', title: 'Field', fieldType: 'mobile' }]),
      )

      const result = await processResponsesV4($, 'formId', {
        f1: v4Response('mobile', {
          value: 'test-value',
          signature: 'some-signature',
        }),
      })

      expect(result).toEqual([
        {
          _id: 'f1',
          fieldType: 'mobile',
          question: 'Field',
          answer: 'test-value',
        },
      ])
    })

    it('maps radiobutton field with answer from answer.value', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          { _id: 'f1', title: 'Choice', fieldType: 'radiobutton' },
        ]),
      )

      const result = await processResponsesV4($, 'formId', {
        f1: v4Response('radiobutton', {
          value: 'Option 2',
          isOthersInput: false,
        }),
      })

      expect(result).toEqual([
        {
          _id: 'f1',
          fieldType: 'radiobutton',
          question: 'Choice',
          answer: 'Option 2',
        },
      ])
    })

    it('maps radiobutton Others selection to "Others: <value>"', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          { _id: 'rb1', title: 'Pick one', fieldType: 'radiobutton' },
        ]),
      )

      const result = await processResponsesV4($, 'formId', {
        rb1: v4Response('radiobutton', {
          value: 'Custom answer',
          isOthersInput: true,
        }),
      })

      expect(result).toEqual([
        {
          _id: 'rb1',
          fieldType: 'radiobutton',
          question: 'Pick one',
          answer: 'Others: Custom answer',
        },
      ])
    })

    it('maps signature fields with answerArray from answer.value', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          { _id: 'sig1', title: 'Sign here', fieldType: 'signature' },
        ]),
      )

      const result = await processResponsesV4($, 'formId', {
        sig1: v4Response('signature', {
          type: 'draw',
          value: [
            [
              [1, 2, 0.5],
              [3, 4, 0.5],
            ],
          ],
        }),
      })

      expect(result).toEqual([
        {
          _id: 'sig1',
          fieldType: 'signature',
          question: 'Sign here',
          answerArray: [
            [
              [1, 2, 0.5],
              [3, 4, 0.5],
            ],
          ],
        },
      ])
    })

    it('maps address fields into ordered answerArray', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          { _id: 'addr1', title: 'Address', fieldType: 'address' },
        ]),
      )

      const result = await processResponsesV4($, 'formId', {
        // deliberately listed in SDK key order (postalCode first) to verify
        // the output uses Plumber's order instead
        addr1: v4Response('address', {
          postalCode: { value: '189554' },
          blockNumber: { value: '51' },
          streetName: { value: 'Bras Basah Road' },
          buildingName: { value: 'Lazada One' },
          levelNumber: { value: '08' },
          unitNumber: { value: '888' },
        }),
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

    it('handles address with missing subfields gracefully', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          { _id: 'addr1', title: 'Address', fieldType: 'address' },
        ]),
      )

      const result = await processResponsesV4($, 'formId', {
        addr1: v4Response('address', {}),
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

    it('maps attachment fields with the filename as answer', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          { _id: 'att1', title: 'Upload file', fieldType: 'attachment' },
        ]),
      )

      const result = await processResponsesV4($, 'formId', {
        att1: v4Response('attachment', {
          value: 'document.pdf',
          hasBeenScanned: true,
          md5Hash: 'abc123',
        }),
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

  describe('children fields', () => {
    it('reconstructs the v3 { child, childFields } answer shape', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          { _id: 'ch1', title: 'Your children', fieldType: 'children' },
        ]),
      )

      const result = await processResponsesV4($, 'formId', {
        ch1: v4Response('children', {
          child0: {
            value: {
              name: { value: 'Alice', myInfo: { attr: 'childname' } },
              dateofbirth: {
                value: '01/01/2020',
                myInfo: { attr: 'childdateofbirth' },
              },
            },
          },
          child1: {
            value: {
              name: { value: 'Bob', myInfo: { attr: 'childname' } },
              dateofbirth: {
                value: '02/02/2022',
                myInfo: { attr: 'childdateofbirth' },
              },
            },
          },
        }),
      })

      expect(result).toEqual([
        {
          _id: 'ch1',
          fieldType: 'children',
          question: 'Your children',
          answer: {
            child: [
              ['Alice', '01/01/2020'],
              ['Bob', '02/02/2022'],
            ],
            childFields: ['name', 'dateofbirth'],
          },
        },
      ])
    })

    it('handles an empty children answer', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          { _id: 'ch1', title: 'Your children', fieldType: 'children' },
        ]),
      )

      const result = await processResponsesV4($, 'formId', {
        ch1: v4Response('children', {}),
      })

      expect(result).toEqual([
        {
          _id: 'ch1',
          fieldType: 'children',
          question: 'Your children',
          answer: { child: [], childFields: [] },
        },
      ])
    })

    it('fills missing child sub-field values with empty strings', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          { _id: 'ch1', title: 'Your children', fieldType: 'children' },
        ]),
      )

      const result = await processResponsesV4($, 'formId', {
        ch1: v4Response('children', {
          child0: {
            value: {
              name: { value: 'Alice' },
              vaxxstatus: { value: 'Vaccinated' },
            },
          },
          child1: {
            value: {
              name: { value: 'Bob' },
            },
          },
        }),
      })

      expect(result[0].answer).toEqual({
        child: [
          ['Alice', 'Vaccinated'],
          ['Bob', ''],
        ],
        childFields: ['name', 'vaxxstatus'],
      })
    })
  })

  describe('table fields', () => {
    it('maps keyed rows to a matrix sorted by rowNum', async () => {
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

      const result = await processResponsesV4($, 'formId', {
        tbl1: v4Response('table', {
          // deliberately out of order to verify rowNum sorting
          'row-b': { rowNum: 1, value: { col1: 'Banana', col2: '5' } },
          'row-a': { rowNum: 0, value: { col1: 'Apple', col2: '3' } },
        }),
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

    it('stringifies numeric cell values', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([{ _id: 'tbl1', title: 'Items', fieldType: 'table' }]),
      )

      const result = await processResponsesV4($, 'formId', {
        tbl1: v4Response('table', {
          'row-a': { rowNum: 0, value: { col1: 'Apple', col2: 3 } },
        }),
      })

      expect(result[0].answerArray).toEqual([['Apple', '3']])
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

      const result = await processResponsesV4($, 'formId', {
        tbl1: v4Response('table', {
          'row-a': { rowNum: 0, value: { col1: 'John Doe', col2: '30' } },
        }),
      })

      expect(result[0].question).toBe('Data (First  Last, Age)')
    })

    it('does not append columns to question if schema has no columns', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([{ _id: 'tbl1', title: 'Items', fieldType: 'table' }]),
      )

      const result = await processResponsesV4($, 'formId', {
        tbl1: v4Response('table', {
          'row-a': { rowNum: 0, value: { col1: 'Apple' } },
        }),
      })

      expect(result[0].question).toBe('Items')
    })
  })

  describe('question fallback', () => {
    it('falls back to "Question N" when form schema has no matching field', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(makeFormSchema([]))

      const result = await processResponsesV4($, 'formId', {
        unknown1: v4Response('textfield', { value: 'hello' }),
        unknown2: v4Response('textfield', { value: 'world' }),
      })

      expect(result[0].question).toBe('Question 1')
      expect(result[1].question).toBe('Question 2')
    })
  })

  describe('form schema fetch failure', () => {
    it('logs error and falls back to question numbers when schema fetch fails', async () => {
      mocks.fetchFormSchema.mockRejectedValueOnce(new Error('Network error'))

      const result = await processResponsesV4($, 'formId', {
        field1: v4Response('textfield', { value: 'test' }),
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

      const result = await processResponsesV4($, 'formId', {
        dt1: v4Response('date', { value: '29/03/2026' }),
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

      const result = await processResponsesV4($, 'formId', {
        dt1: v4Response('date', { value: '01/03/2026' }),
      })

      expect(result[0]).toMatchObject({
        answer: '01 Mar 2026',
      })
    })

    it('should use Sep not Sept for September', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(
        makeFormSchema([
          { _id: 'dt1', title: 'Date of birth', fieldType: 'date' },
        ]),
      )

      const result = await processResponsesV4($, 'formId', {
        dt1: v4Response('date', { value: '01/09/2026' }),
      })

      expect(result[0]).toMatchObject({
        answer: '01 Sep 2026',
      })
    })

    it('uses Question N fallback when field not in schema', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(makeFormSchema([]))

      const result = await processResponsesV4($, 'formId', {
        dt1: v4Response('date', { value: '01/01/2025' }),
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

      const result = await processResponsesV4($, 'formId', {
        f1: v4Response('textfield', { value: 'John' }),
        f2: v4Response('email', { value: 'john@example.com' }),
        f3: v4Response('checkbox', { value: ['Yes'] }),
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

  describe('parity with processResponsesV3', () => {
    // The real SDK adaptV3ToV4 is used purely as a test-data generator here:
    // it turns the proven v3 fixtures into their official v4 equivalents.
    // Production code never calls it.
    it('produces identical output to processResponsesV3 for every field type', async () => {
      // Notably absent: address with missing subfields (adaptV3ToV4 fills
      // empty strings where the v3 path keeps undefined).
      const v3Responses: FormFieldsV3 = {
        f1: { fieldType: 'textfield', answer: 'John' },
        f2: { fieldType: 'checkbox', answer: { value: ['reading', 'gaming'] } },
        f3: { fieldType: 'radiobutton', answer: { value: 'option-1' } },
        f4: {
          fieldType: 'email',
          answer: { value: 'john@example.com', signature: 'some-signature' },
        },
        f5: { fieldType: 'mobile', answer: { value: '+6591234567' } },
        f6: {
          fieldType: 'attachment',
          answer: {
            hasBeenScanned: true,
            answer: 'document.pdf',
            md5Hash: 'abc123',
          },
        },
        f7: {
          fieldType: 'table',
          answer: [
            { col1: 'Apple', col2: '3' },
            { col1: 'Banana', col2: '5' },
          ],
        },
        f8: {
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
        f9: {
          fieldType: 'signature',
          answer: { type: 'draw', value: [[[1, 2, 0.5]]] },
        },
        f10: { fieldType: 'yes_no', answer: 'Yes' },
        f11: {
          fieldType: 'children',
          answer: {
            child: [
              ['Alice', '01/01/2020'],
              ['Bob', '02/02/2022'],
            ],
            childFields: ['name', 'dateofbirth'],
          },
        },
        f12: { fieldType: 'date', answer: '29/03/2026' },
        f13: { fieldType: 'nric', answer: 'S1234567A' },
        f14: {
          fieldType: 'radiobutton',
          answer: { othersInput: 'radio others' },
        },
        f15: {
          fieldType: 'checkbox',
          answer: {
            value: ['reading', '!!FORMSG_INTERNAL_CHECKBOX_OTHERS_VALUE!!'],
            othersInput: 'custom hobby',
          },
        },
      }

      const schema = makeFormSchema([
        { _id: 'f1', title: 'Name', fieldType: 'textfield' },
        { _id: 'f2', title: 'Hobbies', fieldType: 'checkbox' },
        { _id: 'f3', title: 'Pick one', fieldType: 'radiobutton' },
        { _id: 'f4', title: 'Email', fieldType: 'email' },
        { _id: 'f5', title: 'Mobile', fieldType: 'mobile' },
        { _id: 'f6', title: 'Upload file', fieldType: 'attachment' },
        {
          _id: 'f7',
          title: 'Items',
          fieldType: 'table',
          columns: [
            { title: 'Name', _id: 'col1' },
            { title: 'Qty', _id: 'col2' },
          ],
        },
        { _id: 'f8', title: 'Address', fieldType: 'address' },
        { _id: 'f9', title: 'Sign here', fieldType: 'signature' },
        { _id: 'f10', title: 'Agree?', fieldType: 'yes_no' },
        { _id: 'f11', title: 'Your children', fieldType: 'children' },
        // f12 deliberately missing to also cover the Question N fallback
        { _id: 'f13', title: 'NRIC', fieldType: 'nric' },
        { _id: 'f14', title: 'Pick one (others)', fieldType: 'radiobutton' },
        { _id: 'f15', title: 'Hobbies (others)', fieldType: 'checkbox' },
      ])
      mocks.fetchFormSchema
        .mockResolvedValueOnce(schema)
        .mockResolvedValueOnce(schema)

      const expected = await processResponsesV3($, 'formId', v3Responses)

      const v4Responses = adaptV3ToV4(v3Responses, {
        provenance: { submittedAt: '2026-03-29T00:00:00.000Z' },
      })
      const actual = await processResponsesV4($, 'formId', v4Responses)

      expect(actual).toEqual(expected)
    })
  })
  describe('real v4 submission', () => {
    it('maps every field of the shared real submission', async () => {
      mocks.fetchFormSchema.mockResolvedValueOnce(makeExampleV4FormSchema())

      const result = await processResponsesV4(
        $,
        'formId',
        exampleV4Submission.responses,
      )

      expect(result).toHaveLength(54)
      // every question is resolved from the schema — no "[Myinfo] " prefixes
      // from the inline questions and no "Question N" fallbacks
      for (const field of result) {
        expect(field.question).not.toContain('[Myinfo]')
        expect(field.question).not.toMatch(/^Question \d+$/)
      }

      const byId = (id: string) => result.find((field) => field._id === id)

      // MyInfo-prefilled text field
      expect(byId('69eedf3b2e18526ffea6335c')).toEqual({
        _id: '69eedf3b2e18526ffea6335c',
        fieldType: 'textfield',
        question: 'Name',
        answer: 'AH KOW, TAN',
      })
      // date is reformatted dd/MM/yyyy → dd MMM yyyy
      expect(byId('69eedf4120948ed94fae09b9')?.answer).toBe('12 Jan 1980')
      // radiobutton: regular option and others input
      expect(byId('69eeddcf8844a134ddbadc56')?.answer).toBe('Option 2')
      expect(byId('69eeddd53c9ffa7a2b464687')?.answer).toBe('Others: adg')
      // checkbox: FormSG's internal others marker becomes "Others: <input>"
      expect(byId('69eedde76df93497297710b1')?.answerArray).toEqual([
        'Option 2',
        'Others: adw',
        'Option 1',
      ])
      // verified email keeps both the value and the verification signature
      expect(byId('69eede812e18526ffea60af3')).toMatchObject({
        answer: 'ahkow@open.gov.local',
        signature: expect.any(String),
      })
      // unverified email keeps only the value, no signature
      expect(byId('69eede868c2bfbb8748c75d3')).toEqual({
        _id: '69eede868c2bfbb8748c75d3',
        fieldType: 'email',
        question: 'Email',
        answer: 'ahkow@open.gov.local',
      })
      // address keeps all six subfields in Plumber order at this level
      // (processLocalAddress only runs downstream in decrypt-form-response)
      expect(byId('69eede9f2f788da6393fbd91')?.answerArray).toEqual([
        '123',
        'TAN AH MENG ROAD',
        '',
        '',
        '',
        '123456',
      ])
      // signature keeps its raw draw points at this level
      expect(byId('69eedeb17cfa1c89fc419340')?.answerArray).toEqual([
        [
          [167.8428955078125, 74.453125, 0.5],
          [179.0538330078125, 73.73698425292969, 0.5],
        ],
      ])
      // table rows become a matrix and the question gains the column suffix
      expect(byId('69eedec5fd2757b0584e0be5')).toMatchObject({
        question: 'Table (Column 1, Column 2)',
        answerArray: [
          ['a', 'Option 1'],
          ['b', 'Option 2'],
        ],
      })
      // attachment maps the filename into answer
      expect(byId('69eedecafd2757b0584e0c54')?.answer).toBe('Screenshot.png')
    })
  })
})

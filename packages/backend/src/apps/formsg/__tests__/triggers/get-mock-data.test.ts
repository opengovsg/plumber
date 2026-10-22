import type { IGlobalVariable } from '@plumber/types'

import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getFormDetailsFromGlobalVariable: vi.fn(() => ({ formId: 'form-id' })),
  loggerError: vi.fn(),
}))

vi.mock('@/helpers/logger', () => ({
  default: { error: mocks.loggerError },
}))

vi.mock('@/helpers/s3', () => ({
  COMMON_S3_MOCK_FOLDER_PREFIX: 'mock/',
}))

vi.mock('../../common/webhook-settings', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getFormDetailsFromGlobalVariable: mocks.getFormDetailsFromGlobalVariable,
}))

import getMockData from '../../triggers/new-submission/get-mock-data'

const CHILDREN_FIELD_ID = '69c1de89ce7be59aafa2f556'

function makeGlobalVariable(sampleResponses: Record<string, unknown>) {
  return {
    http: { get: vi.fn().mockResolvedValue({ data: sampleResponses }) },
    user: { email: 'user@open.gov.sg' },
    step: { parameters: {} },
    flow: { id: 'flow-id' },
  } as unknown as IGlobalVariable
}

function makeFormSchema(childrenSubFields: string[]) {
  return {
    form: {
      responseMode: 'storage',
      isSubmitterIdCollectionEnabled: false,
      form_fields: [
        {
          _id: CHILDREN_FIELD_ID,
          fieldType: 'children',
          myInfo: { attr: 'childrenbirthrecords' },
          childrenSubFields,
        },
      ],
    },
  }
}

describe('getMockData - MyInfo children fields', () => {
  it('keys every subfield the way a real submission is keyed', async () => {
    const $ = makeGlobalVariable({
      responses: {
        [CHILDREN_FIELD_ID]: { fieldType: 'children', answer: null },
      },
    })

    const result = await getMockData(
      $,
      makeFormSchema(['childname', 'childrace', 'childtype']),
    )

    expect(Object.keys(result.fields)).toEqual([
      `childrenbirthrecords_${CHILDREN_FIELD_ID}_childname_0`,
      `childrenbirthrecords_${CHILDREN_FIELD_ID}_childrace_0`,
      `childrenbirthrecords_${CHILDREN_FIELD_ID}_childtype_0`,
    ])
    // the raw children object is dropped, FormSG returns null for it
    expect(result.fields[CHILDREN_FIELD_ID]).toBeUndefined()
  })

  it('mocks the new childtype subfield', async () => {
    const $ = makeGlobalVariable({
      responses: {
        [CHILDREN_FIELD_ID]: { fieldType: 'children', answer: null },
      },
    })

    const result = await getMockData($, makeFormSchema(['childtype']))

    expect(
      result.fields[`childrenbirthrecords_${CHILDREN_FIELD_ID}_childtype_0`],
    ).toEqual({
      question: '[MyInfo] Child 1 Record type',
      answer: 'SPONSORED',
      fieldType: 'children',
      order: '1.1',
    })
  })

  it('still mocks the subfields the children v2 schema drops', async () => {
    const $ = makeGlobalVariable({
      responses: {
        [CHILDREN_FIELD_ID]: { fieldType: 'children', answer: null },
      },
    })

    const result = await getMockData(
      $,
      makeFormSchema(['childname', 'childsecondaryrace']),
    )

    expect(
      result.fields[`childrenbirthrecords_${CHILDREN_FIELD_ID}_childname_0`]
        .question,
    ).toBe('[MyInfo] Child 1 Name')
    expect(
      result.fields[
        `childrenbirthrecords_${CHILDREN_FIELD_ID}_childsecondaryrace_0`
      ].question,
    ).toBe(' Child 1 Secondary race')
  })

  it('falls back to the raw attribute for an unmapped subfield', async () => {
    const $ = makeGlobalVariable({
      responses: {
        [CHILDREN_FIELD_ID]: { fieldType: 'children', answer: null },
      },
    })

    const result = await getMockData($, makeFormSchema(['childfuturefield']))

    expect(
      result.fields[
        `childrenbirthrecords_${CHILDREN_FIELD_ID}_childfuturefield_0`
      ],
    ).toEqual({
      question: ' Child 1 childfuturefield',
      answer: '',
      fieldType: 'children',
      order: '1.1',
    })
  })
})

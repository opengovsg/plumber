import type { IExecutionStep } from '@plumber/types'

import { describe, expect, it, vi } from 'vitest'

vi.mock('@/models/step', () => ({
  default: {
    query: vi.fn(() => ({
      findById: vi.fn(() => ({
        throwIfNotFound: vi.fn(() => ({ parameters: {} })),
      })),
    })),
  },
}))

vi.mock('@/helpers/s3', () => ({
  parseS3Id: vi.fn(() => null),
}))

import getDataOutMetadata from '../../common/get-data-out-metadata'

const EXISTING_FIELD_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const DELETED_FIELD_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const LATER_FIELD_ID = 'cccccccccccccccccccccccc'
const CHILD_FIELD_KEY = `childrenbirthrecords_${EXISTING_FIELD_ID}_childname_0`
const DELETED_CHILD_FIELD_KEY = `childrenbirthrecords_${DELETED_FIELD_ID}_childname_0`

function createExecutionStep(
  metadata: IExecutionStep['metadata'],
): IExecutionStep {
  return {
    stepId: 'test-step-id',
    metadata,
    dataOut: {
      fields: {
        [EXISTING_FIELD_ID]: {
          question: 'Name?',
          answer: 'Alice',
          fieldType: 'textfield',
          order: 1,
        },
        [DELETED_FIELD_ID]: {
          question: 'Email?',
          answer: 'alice@example.com',
          fieldType: 'textfield',
          order: 2,
        },
        [LATER_FIELD_ID]: {
          question: 'Phone?',
          answer: '12345678',
          fieldType: 'textfield',
          order: 3,
        },
        [CHILD_FIELD_KEY]: {
          question: 'Child name',
          answer: 'Bob',
          fieldType: 'children',
          order: 4,
        },
        [DELETED_CHILD_FIELD_KEY]: {
          question: 'Child name',
          answer: 'Carol',
          fieldType: 'children',
          order: 5,
        },
      },
      submissionId: 'sub-123',
      formId: 'form-123',
    },
  } as unknown as IExecutionStep
}

describe('getDataOutMetadata - deleted questions', () => {
  it('hides answers to questions absent from formFieldIds', async () => {
    const result = await getDataOutMetadata(
      createExecutionStep({
        formFieldIds: [EXISTING_FIELD_ID, LATER_FIELD_ID],
      }),
    )

    expect(result.fields[DELETED_FIELD_ID]).toEqual({ isHidden: true })
    expect(result.fields[DELETED_CHILD_FIELD_KEY]).toEqual({ isHidden: true })
    expect(result.fields[CHILD_FIELD_KEY].isHidden).toBeUndefined()
  })

  it('numbers questions as if the deleted question never existed', async () => {
    const result = await getDataOutMetadata(
      createExecutionStep({
        formFieldIds: [EXISTING_FIELD_ID, LATER_FIELD_ID],
      }),
    )

    expect(result.fields[LATER_FIELD_ID].question.label).toEqual('Question 2')
  })

  it('shows every answer when the trigger recorded no field IDs', async () => {
    const result = await getDataOutMetadata(createExecutionStep({}))

    expect(result.fields[DELETED_FIELD_ID].isHidden).toBeUndefined()
  })
})

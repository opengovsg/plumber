import type { IExecutionStep } from '@plumber/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  stepParameters: {} as Record<string, unknown>,
}))

vi.mock('@/models/step', () => ({
  default: {
    query: vi.fn(() => ({
      findById: vi.fn(() => ({
        throwIfNotFound: vi.fn(() => ({ parameters: mocks.stepParameters })),
      })),
    })),
  },
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('@/helpers/s3', () => ({
  parseS3Id: vi.fn(() => null),
}))

import getDataOutMetadata from '../../common/get-data-out-metadata'

function createExecutionStep(
  fields: Record<
    string,
    {
      question: string
      answer?: string
      fieldType: string
      order: number
      myInfo?: { attr: string }
    }
  >,
): IExecutionStep {
  return {
    stepId: 'test-step-id',
    dataOut: {
      fields,
      submissionId: 'sub-123',
      formId: 'form-123',
    },
  } as unknown as IExecutionStep
}

describe('getDataOutMetadata - MRF field filtering', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe('when parameters.mrf is set', () => {
    beforeEach(() => {
      mocks.stepParameters = {
        mrf: {
          defaultStepName: 'Step 2',
          formWorkflowStepId: 'wf-step-002',
          type: 'static',
          fields: ['field1', 'field3'],
          approvalField: undefined,
        },
      }
    })

    it('should hide fields not in mrf.fields', async () => {
      const executionStep = createExecutionStep({
        field1: {
          question: 'Name?',
          answer: 'Alice',
          fieldType: 'textfield',
          order: 1,
        },
        field2: {
          question: 'Email?',
          answer: 'alice@example.com',
          fieldType: 'textfield',
          order: 2,
        },
        field3: {
          question: 'Phone?',
          answer: '12345678',
          fieldType: 'textfield',
          order: 3,
        },
      })

      const result = await getDataOutMetadata(executionStep)

      // field2 is not in mrf.fields, so all its properties should be hidden
      expect(result.fields.field2).toEqual({
        isHidden: true,
      })
    })

    it('should show fields that are in mrf.fields with normal metadata', async () => {
      const executionStep = createExecutionStep({
        field1: {
          question: 'Name?',
          answer: 'Alice',
          fieldType: 'textfield',
          order: 1,
        },
        field2: {
          question: 'Email?',
          answer: 'alice@example.com',
          fieldType: 'textfield',
          order: 2,
        },
      })

      const result = await getDataOutMetadata(executionStep)

      // field1 is in mrf.fields, should have normal question/answer metadata
      expect(result.fields.field1.question).toEqual(
        expect.objectContaining({
          type: 'text',
          label: expect.stringContaining('Question'),
        }),
      )
      expect(result.fields.field1.answer).toEqual(
        expect.objectContaining({
          type: 'text',
        }),
      )
    })

    it('should mark approval field answer type as approval', async () => {
      mocks.stepParameters = {
        mrf: {
          defaultStepName: 'Step 2',
          formWorkflowStepId: 'wf-step-002',
          type: 'static',
          fields: ['field1', 'field2'],
          approvalField: 'field2',
        },
      }

      const executionStep = createExecutionStep({
        field1: {
          question: 'Name?',
          answer: 'Alice',
          fieldType: 'textfield',
          order: 1,
        },
        field2: {
          question: 'Do you approve?',
          answer: 'Yes',
          fieldType: 'textfield',
          order: 2,
        },
      })

      const result = await getDataOutMetadata(executionStep)

      expect(result.fields.field2.answer.type).toBe('approval')
    })

    it('should not mark non-approval fields as approval', async () => {
      mocks.stepParameters = {
        mrf: {
          defaultStepName: 'Step 2',
          formWorkflowStepId: 'wf-step-002',
          type: 'static',
          fields: ['field1', 'field2'],
          approvalField: 'field2',
        },
      }

      const executionStep = createExecutionStep({
        field1: {
          question: 'Name?',
          answer: 'Alice',
          fieldType: 'textfield',
          order: 1,
        },
        field2: {
          question: 'Do you approve?',
          answer: 'Yes',
          fieldType: 'textfield',
          order: 2,
        },
      })

      const result = await getDataOutMetadata(executionStep)

      expect(result.fields.field1.answer.type).toBe('text')
    })

    it('should increment question order for all fields including hidden MRF fields', async () => {
      // field1 (order 1), field2 (hidden, order 2), field3 (order 3)
      // Hidden fields still consume order numbers
      const executionStep = createExecutionStep({
        field1: {
          question: 'Q1',
          answer: 'A1',
          fieldType: 'textfield',
          order: 1,
        },
        field2: {
          question: 'Q2',
          answer: 'A2',
          fieldType: 'textfield',
          order: 2,
        },
        field3: {
          question: 'Q3',
          answer: 'A3',
          fieldType: 'textfield',
          order: 3,
        },
      })

      const result = await getDataOutMetadata(executionStep)

      // field1 is visible, gets question order 1
      expect(result.fields.field1.question.label).toBe('Question 1')
      // field3 is visible, gets question order 3 (field2 consumed order 2 even though hidden)
      expect(result.fields.field3.question.label).toBe('Question 3')
    })

    it('should handle mrf.approvalField being undefined', async () => {
      // approvalField is already undefined in the default beforeEach setup
      const executionStep = createExecutionStep({
        field1: {
          question: 'Q1',
          answer: 'A1',
          fieldType: 'textfield',
          order: 1,
        },
        field3: {
          question: 'Q3',
          answer: 'A3',
          fieldType: 'textfield',
          order: 2,
        },
      })

      const result = await getDataOutMetadata(executionStep)

      // No field should have type 'approval'
      expect(result.fields.field1.answer.type).toBe('text')
      expect(result.fields.field3.answer.type).toBe('text')
    })

    it('should hide all fields when mrf.fields is empty', async () => {
      mocks.stepParameters = {
        mrf: {
          defaultStepName: 'Step 2',
          formWorkflowStepId: 'wf-step-002',
          type: 'static',
          fields: [],
          approvalField: undefined,
        },
      }

      const executionStep = createExecutionStep({
        field1: {
          question: 'Q1',
          answer: 'A1',
          fieldType: 'textfield',
          order: 1,
        },
        field2: {
          question: 'Q2',
          answer: 'A2',
          fieldType: 'textfield',
          order: 2,
        },
      })

      const result = await getDataOutMetadata(executionStep)

      // All fields should have the hidden structure
      expect(result.fields.field1).toEqual({
        isHidden: true,
      })
      expect(result.fields.field2).toEqual({
        isHidden: true,
      })
    })
  })

  describe('when parameters.mrf is absent', () => {
    beforeEach(() => {
      mocks.stepParameters = {}
    })

    it('should not apply MRF filtering', async () => {
      const executionStep = createExecutionStep({
        field1: {
          question: 'Name?',
          answer: 'Alice',
          fieldType: 'textfield',
          order: 1,
        },
        field2: {
          question: 'Email?',
          answer: 'alice@example.com',
          fieldType: 'textfield',
          order: 2,
        },
      })

      const result = await getDataOutMetadata(executionStep)

      // Both fields should be visible with normal metadata
      expect(result.fields.field1.question).toEqual(
        expect.objectContaining({
          type: 'text',
          label: expect.stringContaining('Question'),
        }),
      )
      expect(result.fields.field2.question).toEqual(
        expect.objectContaining({
          type: 'text',
          label: expect.stringContaining('Question'),
        }),
      )
    })
  })
})

import { IGlobalVariable } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import { FormSchema } from '../../common/types'
import { parseWorkflowData } from '../../triggers/new-submission/get-workflow-data'

function createMockGlobalVariable(
  overrides: Partial<IGlobalVariable> = {},
): IGlobalVariable {
  return {
    step: { position: 1 },
    app: { name: 'formsg' },
    ...overrides,
  } as unknown as IGlobalVariable
}

function createFormSchema(
  workflow: FormSchema['form']['workflow'],
): FormSchema {
  return {
    form: {
      workflow,
      publicKey: 'test-key',
      responseMode: 'encrypt',
      _id: 'form-id',
      title: 'Test Form',
      status: 'PUBLIC',
      form_fields: [],
      authType: 'NIL',
      isSubmitterIdCollectionEnabled: false,
    },
  }
}

describe('parseWorkflowData', () => {
  const $ = createMockGlobalVariable()

  describe('valid workflow data', () => {
    it('should parse a single step workflow', () => {
      const formSchema = createFormSchema([
        {
          _id: 'step-001',
          edit: ['field-a', 'field-b'],
          step_name: 'First Step',
          workflow_type: 'static',
        },
      ])

      const result = parseWorkflowData($, formSchema)

      expect(result).toEqual({
        trigger: {
          defaultStepName: 'First Step',
          type: 'static',
          fields: ['field-a', 'field-b'],
          formWorkflowStepId: 'step-001',
          approvalField: undefined,
        },
        actions: [],
      })
    })

    it('should accumulate fields cumulatively across steps', () => {
      const formSchema = createFormSchema([
        {
          _id: 'step-001',
          edit: ['field-a'],
          step_name: 'Step 1',
          workflow_type: 'static',
        },
        {
          _id: 'step-002',
          edit: ['field-b'],
          step_name: 'Step 2',
          workflow_type: 'dynamic',
        },
        {
          _id: 'step-003',
          edit: ['field-c'],
          step_name: 'Step 3',
          workflow_type: 'conditional',
        },
      ])

      const result = parseWorkflowData($, formSchema)

      // Step 1 (trigger) has only its own fields
      expect(result?.trigger.fields).toEqual(['field-a'])
      // Step 2 accumulates step 1 + step 2 fields
      expect(result?.actions[0].fields).toEqual(['field-a', 'field-b'])
      // Step 3 accumulates step 1 + step 2 + step 3 fields
      expect(result?.actions[1].fields).toEqual([
        'field-a',
        'field-b',
        'field-c',
      ])
    })

    it('should use default step name when step_name is not provided', () => {
      const formSchema = createFormSchema([
        {
          _id: 'step-001',
          edit: [],
          workflow_type: 'static',
        },
        {
          _id: 'step-002',
          edit: [],
          workflow_type: 'static',
        },
      ])

      const result = parseWorkflowData($, formSchema)

      expect(result?.trigger.defaultStepName).toBe('MRF Step 1')
      expect(result?.actions[0].defaultStepName).toBe('MRF Step 2')
    })
  })

  describe('invalid workflow data', () => {
    it('should throw StepError when workflow is undefined', () => {
      const formSchema = createFormSchema(undefined)

      expect(() => parseWorkflowData($, formSchema)).toThrow('Invalid MRF data')
    })
  })
})

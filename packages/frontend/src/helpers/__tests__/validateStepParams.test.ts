import type { IExecutionStep, IStep, ISubstep } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import { validateStepParams } from '../validateStepParams'

const TRIGGER_STEP_ID = '11111111-1111-4111-8111-111111111111'
const ACTION_STEP_ID = '22222222-2222-4222-8222-222222222222'
const EXISTING_FIELD_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const DELETED_FIELD_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb'
// MyInfo children answers are keyed by a composite ID derived from the parent
// question. Mirrors what get-mock-data.ts and decrypt-form-response.ts produce.
const CHILD_FIELD_KEY = `childrenbirthrecords_${EXISTING_FIELD_ID}_childname_0`
const DELETED_CHILD_FIELD_KEY = `childrenbirthrecords_${DELETED_FIELD_ID}_childname_0`

function buildExecutionStep(
  stepId: string,
  position: number,
  metadata: IExecutionStep['metadata'] = {},
): IExecutionStep {
  return {
    id: `execution-step-${stepId}`,
    stepId,
    step: { id: stepId, position } as IStep,
    status: 'success',
    metadata,
  } as IExecutionStep
}

function buildActionStep(parameters: IStep['parameters']): IStep {
  return {
    id: ACTION_STEP_ID,
    position: 2,
    parameters,
  } as IStep
}

const SUBSTEPS = [
  {
    key: 'setUpAction',
    name: 'Set up action',
    arguments: [{ key: 'body', label: 'Body', type: 'string' }],
  },
] as ISubstep[]

describe('validateStepParams', () => {
  it('does not flag a reference to an existing FormSG question', () => {
    const { shouldTestStepAgain } = validateStepParams(
      buildActionStep({
        body: `Hello {{step.${TRIGGER_STEP_ID}.fields.${EXISTING_FIELD_ID}.answer}}`,
      }),
      [
        buildExecutionStep(TRIGGER_STEP_ID, 1, {
          formFieldIds: [EXISTING_FIELD_ID, DELETED_FIELD_ID],
        }),
        buildExecutionStep(ACTION_STEP_ID, 2),
      ],
      SUBSTEPS,
    )

    expect(shouldTestStepAgain).toEqual(false)
  })

  it('flags a reference to a FormSG question that was deleted from the form', () => {
    const { shouldTestStepAgain } = validateStepParams(
      buildActionStep({
        body: `Hello {{step.${TRIGGER_STEP_ID}.fields.${DELETED_FIELD_ID}.answer}}`,
      }),
      [
        buildExecutionStep(TRIGGER_STEP_ID, 1, {
          formFieldIds: [EXISTING_FIELD_ID],
        }),
        buildExecutionStep(ACTION_STEP_ID, 2),
      ],
      SUBSTEPS,
    )

    expect(shouldTestStepAgain).toEqual(true)
  })

  it('flags a deleted question referenced from a nested parameter', () => {
    const { shouldTestStepAgain } = validateStepParams(
      buildActionStep({
        body: [
          { value: 'static text' },
          {
            value: `{{step.${TRIGGER_STEP_ID}.fields.${DELETED_FIELD_ID}.question}}`,
          },
        ],
      }),
      [
        buildExecutionStep(TRIGGER_STEP_ID, 1, {
          formFieldIds: [EXISTING_FIELD_ID],
        }),
        buildExecutionStep(ACTION_STEP_ID, 2),
      ],
      SUBSTEPS,
    )

    expect(shouldTestStepAgain).toEqual(true)
  })

  it('does not flag questions when the trigger recorded no field IDs', () => {
    const { shouldTestStepAgain } = validateStepParams(
      buildActionStep({
        body: `Hello {{step.${TRIGGER_STEP_ID}.fields.${DELETED_FIELD_ID}.answer}}`,
      }),
      [
        buildExecutionStep(TRIGGER_STEP_ID, 1),
        buildExecutionStep(ACTION_STEP_ID, 2),
      ],
      SUBSTEPS,
    )

    expect(shouldTestStepAgain).toEqual(false)
  })

  it('does not flag non-question references such as submitter info', () => {
    const { shouldTestStepAgain } = validateStepParams(
      buildActionStep({
        body: `Hello {{step.${TRIGGER_STEP_ID}.verifiedSubmitterInfo.uinFin}}`,
      }),
      [
        buildExecutionStep(TRIGGER_STEP_ID, 1, {
          formFieldIds: [EXISTING_FIELD_ID],
        }),
        buildExecutionStep(ACTION_STEP_ID, 2),
      ],
      SUBSTEPS,
    )

    expect(shouldTestStepAgain).toEqual(false)
  })

  it('ignores parameters that the step does not support', () => {
    const { shouldTestStepAgain } = validateStepParams(
      buildActionStep({
        leftoverParam: `{{step.${TRIGGER_STEP_ID}.fields.${DELETED_FIELD_ID}.answer}}`,
      }),
      [
        buildExecutionStep(TRIGGER_STEP_ID, 1, {
          formFieldIds: [EXISTING_FIELD_ID],
        }),
        buildExecutionStep(ACTION_STEP_ID, 2),
      ],
      SUBSTEPS,
    )

    expect(shouldTestStepAgain).toEqual(false)
  })

  it('does not flag a MyInfo children answer whose parent question still exists', () => {
    const { shouldTestStepAgain } = validateStepParams(
      buildActionStep({
        body: `Hello {{step.${TRIGGER_STEP_ID}.fields.${CHILD_FIELD_KEY}.answer}}`,
      }),
      [
        buildExecutionStep(TRIGGER_STEP_ID, 1, {
          formFieldIds: [EXISTING_FIELD_ID],
        }),
        buildExecutionStep(ACTION_STEP_ID, 2),
      ],
      SUBSTEPS,
    )

    expect(shouldTestStepAgain).toEqual(false)
  })

  it('flags a MyInfo children answer whose parent question was deleted', () => {
    const { shouldTestStepAgain } = validateStepParams(
      buildActionStep({
        body: `Hello {{step.${TRIGGER_STEP_ID}.fields.${DELETED_CHILD_FIELD_KEY}.answer}}`,
      }),
      [
        buildExecutionStep(TRIGGER_STEP_ID, 1, {
          formFieldIds: [EXISTING_FIELD_ID],
        }),
        buildExecutionStep(ACTION_STEP_ID, 2),
      ],
      SUBSTEPS,
    )

    expect(shouldTestStepAgain).toEqual(true)
  })

  it('flags a MyInfo children answer whose parent question was recreated under a new ID', () => {
    const { shouldTestStepAgain } = validateStepParams(
      buildActionStep({
        body: `Hello {{step.${TRIGGER_STEP_ID}.fields.${CHILD_FIELD_KEY}.answer}}`,
      }),
      [
        buildExecutionStep(TRIGGER_STEP_ID, 1, {
          formFieldIds: ['cccccccccccccccccccccccc'],
        }),
        buildExecutionStep(ACTION_STEP_ID, 2),
      ],
      SUBSTEPS,
    )

    expect(shouldTestStepAgain).toEqual(true)
  })

  it('still flags references to steps that no longer exist', () => {
    const { shouldTestStepAgain } = validateStepParams(
      buildActionStep({
        body: `Hello {{step.${TRIGGER_STEP_ID}.fields.${EXISTING_FIELD_ID}.answer}}`,
      }),
      [buildExecutionStep(ACTION_STEP_ID, 2)],
      SUBSTEPS,
    )

    expect(shouldTestStepAgain).toEqual(true)
  })

  it('returns no test result when the step was never tested', () => {
    const result = validateStepParams(
      buildActionStep({ body: 'Hello' }),
      [buildExecutionStep(TRIGGER_STEP_ID, 1)],
      SUBSTEPS,
    )

    expect(result.shouldTestStepAgain).toEqual(false)
    expect(result.isTestSuccessful).toBeFalsy()
  })
})

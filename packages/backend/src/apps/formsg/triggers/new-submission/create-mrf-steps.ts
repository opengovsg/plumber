import { IGlobalVariable, IStep } from '@plumber/types'

import get from 'lodash.get'
import { raw } from 'objection'

import Step from '@/models/step'

import { ParsedMrfWorkflow } from '../../common/types'

const MRF_KEY = 'mrfSubmission'
const MRF_APP_KEY = 'formsg'

export async function createMrfSteps(
  $: IGlobalVariable,
  mrfWorkflow: ParsedMrfWorkflow,
) {
  const { trigger, actions } = mrfWorkflow

  await Step.transaction(async (trx) => {
    const triggerStepName = `MRF: ${trigger.defaultStepName}`
    // Update the trigger step parameters
    const updatedTriggerStep = await Step.query(trx).patchAndFetchById(
      $.step.id,
      {
        parameters: {
          mrf: trigger,
        },
        config: raw(
          `jsonb_set(config, '{stepName}', to_jsonb(?::text), true)`,
          [triggerStepName],
        ),
      },
    )

    const existingMrfSteps = await Step.query(trx)
      .where('flow_id', $.flow.id)
      .where('type', 'action')
      .where('key', MRF_KEY)

    // Get all formWorkflowStepIds from actions
    const actionStepIds = new Set(
      actions.map((action) => action.formWorkflowStepId),
    )

    // Delete steps that no longer exist in actions
    const stepsToDelete = existingMrfSteps.filter((step) => {
      const formWorkflowStepId = get(
        step.parameters,
        'mrf.formWorkflowStepId',
        null,
      )
      return !formWorkflowStepId || !actionStepIds.has(formWorkflowStepId)
    })

    for (const step of stepsToDelete) {
      const deletedStep = await Step.query(trx).patchAndFetchById(step.id, {
        deletedAt: new Date().toISOString(),
      })
      // Shift up all steps after the deleted one
      await Step.query(trx)
        .where('flow_id', $.flow.id)
        .where('position', '>', deletedStep.position)
        .decrement('position', 1)
    }

    // we start from after the trigger step first
    let newStepPosition = 2
    // Create or update steps for each action
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]
      const existingStep = existingMrfSteps.find((step) => {
        const formWorkflowStepId = get(
          step.parameters,
          'mrf.formWorkflowStepId',
          null,
        )
        return formWorkflowStepId === action.formWorkflowStepId
      })

      const parameters = {
        mrf: action,
      } as unknown as IStep['parameters']

      const stepName = `MRF: ${action.defaultStepName}`

      if (existingStep) {
        // Update existing step
        const updatedStep = await Step.query(trx).patchAndFetchById(
          existingStep.id,
          {
            connectionId: updatedTriggerStep.connectionId,
            parameters,
            config: raw(
              `jsonb_set(config, '{stepName}', to_jsonb(?::text), true)`,
              [stepName],
            ),
          },
        )
        newStepPosition = updatedStep.position + 1
      } else {
        // Shift all steps after this position down
        await Step.query(trx)
          .where('flow_id', $.flow.id)
          .where('position', '>=', newStepPosition)
          .increment('position', 1)

        // Create new step at the correct position
        const newStep = await Step.query(trx).insert({
          flowId: $.flow.id,
          type: 'action',
          appKey: MRF_APP_KEY,
          key: MRF_KEY,
          position: newStepPosition,
          connectionId: updatedTriggerStep.connectionId,
          parameters,
          config: {
            stepName,
          },
        })
        newStepPosition = newStep.position + 1
      }
    }
  })
}

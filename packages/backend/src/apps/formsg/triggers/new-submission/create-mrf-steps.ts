import { IGlobalVariable, IStep } from '@plumber/types'

import get from 'lodash.get'
import { raw, Transaction } from 'objection'

import Step from '@/models/step'

import { ParsedMrfWorkflow } from '../../common/types'

const MRF_KEY = 'mrfSubmission'
const MRF_APP_KEY = 'formsg'

async function deleteAllStepsInMrfBranch(
  allSteps: Step[],
  mrfStepId: string,
  trx: Transaction,
) {
  const mrfStep = allSteps.find((step) => step.id === mrfStepId)
  const nextMrfStep = allSteps.find(
    (step) =>
      step.position > mrfStep.position &&
      step.type === 'action' &&
      step.key === MRF_KEY,
  )
  const stepsInMrfBranch = allSteps.filter((step) => {
    if (nextMrfStep) {
      return (
        step.position >= mrfStep.position &&
        step.position < nextMrfStep.position
      )
    }
    return step.position >= mrfStep.position
  })
  await Step.query(trx)
    .whereIn(
      'steps.id',
      stepsInMrfBranch.map((step) => step.id),
    )
    .delete()
}

async function deleteAllStepsInRejectBranch(
  allSteps: Step[],
  mrfStepId: string,
  trx: Transaction,
) {
  const stepsInRejectBranch = allSteps.filter((step) => {
    return (
      step.config?.approval?.branch === 'reject' &&
      step.config?.approval?.stepId === mrfStepId
    )
  })
  await Step.query(trx)
    .whereIn(
      'steps.id',
      stepsInRejectBranch.map((step) => step.id),
    )
    .delete()
}

export async function createMrfSteps(
  $: IGlobalVariable,
  mrfWorkflow: ParsedMrfWorkflow,
) {
  const { trigger, actions } = mrfWorkflow

  await Step.transaction(async (trx) => {
    const triggerStepName = trigger.defaultStepName
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

    const allExistingSteps = await Step.query(trx).where('flow_id', $.flow.id)

    const existingMrfSteps = allExistingSteps.filter((step) => {
      return step.type === 'action' && step.key === MRF_KEY
    })

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

    /**
     * This part handles deletion of MRF steps
     */
    for (const stepToDelete of stepsToDelete) {
      await stepToDelete.$query(trx).delete()
      // we delete all steps in the mrf branch when the mrf step is deleted
      await deleteAllStepsInMrfBranch(allExistingSteps, stepToDelete.id, trx)
    }

    // Track where to insert the next new mrf step
    let newMrfStepPositionToInsert = 2
    // Track all the newly added mrf step positions
    const newMrfSteps: Step[] = []

    // Create or update steps for each action
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]
      const stepToUpdate = existingMrfSteps.find((step) => {
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

      const stepName = action.defaultStepName

      if (stepToUpdate) {
        // Update existing step
        await Step.query(trx).patchAndFetchById(stepToUpdate.id, {
          connectionId: updatedTriggerStep.connectionId,
          parameters,
          config: raw(
            `jsonb_set(config, '{stepName}', to_jsonb(?::text), true)`,
            [stepName],
          ),
        })
        // there could be a case where it changed from an approval step to a normal steps
        if (!action.approvalField) {
          // Delete all steps in the reject branch (if any)
          await deleteAllStepsInRejectBranch(
            allExistingSteps,
            stepToUpdate.id,
            trx,
          )
        }
        // update the position to insert after this existing mrf step
        newMrfStepPositionToInsert = stepToUpdate.position + 1
        continue
      }
      // Create new mrf steps after the last created mrf step (if any)
      const newStep = await Step.query(trx).insert({
        flowId: $.flow.id,
        type: 'action',
        appKey: MRF_APP_KEY,
        key: MRF_KEY,
        position: newMrfStepPositionToInsert,
        connectionId: updatedTriggerStep.connectionId,
        parameters,
        config: {
          stepName,
        },
      })
      newMrfSteps.push(newStep)
      newMrfStepPositionToInsert = newStep.position + 1
    }

    /**
     * Handle steps after the last newly created mrf step
     * CAVEAT: this relies heavily on the fact that new MRF steps are always added at the end of the formsg workflow
     * If last created mrf step has approval field, we need to update the steps in the reject branch to point to the last created mrf step
     * If last created mrf step does not have approval field, we need to delete the steps in the reject branch
     * We cannot add new mrf actions at the end of the pipe since it might appear after the if-then or for-loop steps
     */
    if (newMrfSteps.length > 0) {
      // Shift down all steps after the newly added mrf steps
      await Step.query(trx)
        .where('flow_id', $.flow.id)
        .where('position', '>=', newMrfSteps[0].position)
        .andWhereNot('key', MRF_KEY)
        .andWhereNot('app_key', MRF_APP_KEY)
        .increment('position', newMrfSteps.length)

      // Get all the step ids in the reject branch
      const stepIdsInRejectBranch = allExistingSteps
        .filter((step) => {
          return (
            step.config?.approval?.branch === 'reject' &&
            step.position >= newMrfSteps[0].position
          )
        })
        .map((step) => step.id)

      const finalMrfStep = newMrfSteps[newMrfSteps.length - 1]
      if (actions[actions.length - 1].approvalField) {
        // If last mrf step has approval field, update the steps in the reject branch to point to the last created mrf step
        await Step.query(trx)
          .whereIn('steps.id', stepIdsInRejectBranch)
          .patch({
            config: raw(
              `jsonb_set(config, '{approval,stepId}', to_jsonb(?::text), true)`,
              finalMrfStep.id,
            ),
          })
      } else {
        // If last mrf step does not have approval field, delete the steps in the reject branch
        await Step.query(trx)
          .whereIn('steps.id', stepIdsInRejectBranch)
          .delete()
      }
    }

    // this is to fill the gaps in the step positions
    await Step.resetStepOrdering($.flow.id, trx)
  })
}

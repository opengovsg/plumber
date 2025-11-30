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
      // Delete all steps in the reject branch
      await Step.query(trx)
        .where('flow_id', $.flow.id)
        .where('position', '>', deletedStep.position)
        .andWhereRaw(`steps.config->'approval'->>'stepId' = ?`, [
          deletedStep.id,
        ])
        .delete()
    }

    let newMrfStepPositionToInsert = 2
    // Track all the newly added mrf step positions
    const newMrfSteps = []

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
        // there could be a case where it changed from an approval step to a normal steps
        if (!action.approvalField) {
          // Delete all steps in the reject branch (if any)
          await Step.query(trx)
            .where('flow_id', $.flow.id)
            .where('position', '>', updatedStep.position)
            .andWhereRaw(`steps.config->'approval'->>'stepId' = ?`, [
              updatedStep.id,
            ])
            .delete()
        }
        newMrfStepPositionToInsert = updatedStep.position + 1
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
     */
    if (newMrfSteps.length > 0) {
      // Shift down all steps after the newly added mrf steps
      await Step.query(trx)
        .where('flow_id', $.flow.id)
        .where('position', '>=', newMrfSteps[0].position)
        .andWhereNot('key', MRF_KEY)
        .andWhereNot('app_key', MRF_APP_KEY)
        .increment('position', newMrfSteps.length)
      const stepIdsInRejectBranch = await Step.query(trx)
        .select('steps.id as id')
        .where('flow_id', $.flow.id)
        .where('position', '>=', newMrfStepPositionToInsert)
        .andWhereRaw(`steps.config->'approval'->>'branch' = ?`, ['reject'])
      const finalMrfStep = newMrfSteps[newMrfSteps.length - 1]
      if (actions[actions.length - 1].approvalField) {
        await Step.query(trx)
          .whereIn(
            'steps.id',
            stepIdsInRejectBranch.map((step) => step.id),
          )
          .patch({
            config: raw(
              `jsonb_set(config, '{approval,stepId}', to_jsonb(?::text), true)`,
              finalMrfStep.id,
            ),
          })
      } else {
        await Step.query(trx)
          .whereIn(
            'steps.id',
            stepIdsInRejectBranch.map((step) => step.id),
          )
          .delete()
      }
    }

    // this is to fill the gaps in the step positions
    await Step.resetStepOrdering($.flow.id, trx)
  })
}

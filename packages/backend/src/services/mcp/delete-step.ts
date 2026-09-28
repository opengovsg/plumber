import { raw } from 'objection'

import { removeMrfSteps } from '@/apps/formsg/triggers/new-submission/remove-mrf-steps'
import {
  deriveIfThenV1EndStep,
  expandIfThenBlockDeletions,
} from '@/apps/toolbox/actions/if-then/infra/end-step-utils'
import { isIfThenStep, isIfThenV2 } from '@/apps/toolbox/common/constants'
import {
  repairEndStepsOnDeleteStep,
  upgradeIfThenV1BlocksIfEnabled,
} from '@/apps/toolbox/common/validate-end-step'
import { hasStepReference } from '@/helpers/check-step-parameters'
import logger from '@/helpers/logger'
import Flow from '@/models/flow'
import Step from '@/models/step'
import type User from '@/models/user'

import { PublishedPipeError } from './published-pipe-error'

export interface DeleteStepInput {
  user: User
  pipeId: string
  stepId: string
}

export async function deleteStepService({
  user,
  pipeId,
  stepId,
}: DeleteStepInput): Promise<Flow> {
  return Step.transaction(async (trx) => {
    await trx.raw('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;')

    const step = await user
      .withAccessibleSteps({ requiredRole: 'editor', trx })
      .withGraphFetched('flow')
      .findOne({ 'steps.id': stepId, 'steps.flow_id': pipeId })

    if (!step) {
      throw new Error('Step not found')
    }

    const flow = step.flow

    if (flow.active) {
      throw new PublishedPipeError()
    }

    // Pin any other legacy If block before the delete, so the repair pass
    // can shrink it. The block being deleted is excluded. A legacy If has
    // no marker, and its extent is resolved below instead.
    await upgradeIfThenV1BlocksIfEnabled(
      trx,
      flow,
      await flow.$relatedQuery('steps', trx).orderBy('position', 'asc'),
      new Set([stepId]),
    )

    const stepsBeforeDelete = await flow
      .$relatedQuery('steps', trx)
      .orderBy('position', 'asc')

    const stepsToDelete = stepsRemovedWith(stepsBeforeDelete, stepId, flow.id)

    if (step.type === 'trigger') {
      if (step.appKey === 'formsg' && step.key === 'newSubmission') {
        await removeMrfSteps(flow.id, trx)
      }

      const allSteps = await flow
        .$relatedQuery('steps', trx)
        .where('id', '!=', stepId)
        .orderBy('position', 'asc')

      const stepsToInvalidate = getStepsToInvalidate(
        allSteps,
        new Set([stepId]),
      )
      await Step.query(trx)
        .findByIds(stepsToInvalidate)
        .patch({ status: 'incomplete' })

      await step.$query(trx).delete()
      await flow.$relatedQuery('steps', trx).insert({
        key: null,
        appKey: null,
        type: 'trigger',
        position: 1,
        parameters: {},
        connectionId: null,
      })
    } else {
      if (
        !stepsToDelete.every(
          (stepToDelete, index) =>
            (index === 0 ||
              stepToDelete.position ===
                stepsToDelete[index - 1].position + 1) &&
            stepToDelete.type === 'action',
        )
      ) {
        throw new Error('Must delete contiguous action steps!')
      }

      const stepIds = stepsToDelete.map((stepToDelete) => stepToDelete.id)
      const allSteps = await flow
        .$relatedQuery('steps', trx)
        .whereNotIn('id', stepIds)
        .orderBy('position', 'asc')

      const stepsToInvalidate = getStepsToInvalidate(allSteps, new Set(stepIds))
      await Step.query(trx)
        .findByIds(stepsToInvalidate)
        .patch({ status: 'incomplete' })

      await Step.query(trx).findByIds(stepIds).delete()

      await flow
        .$relatedQuery('steps', trx)
        .where(
          'position',
          '>',
          stepsToDelete[stepsToDelete.length - 1].position,
        )
        .patch({ position: raw(`position - ${stepsToDelete.length}`) })
    }

    // Deleting an If removes its whole block, matching the editor. Deleting a
    // step inside a block removes only that step, and the repair below shrinks
    // the block when that step was its end.
    await repairEndStepsOnDeleteStep({ trx, flow, stepsBeforeDelete })

    await flow.patchLastUpdated({
      flowId: flow.id,
      updatedBy: user.id,
      trx,
    })

    return flow
      .$query(trx)
      .withGraphJoined('steps')
      .orderBy('steps.position', 'asc')
  })
}

/**
 * The editor removes an If block by deleting its If step. A marked block
 * expands through endStepId. A legacy block has no marker, so the same
 * derived extent the editor would have sent is removed instead.
 */
function stepsRemovedWith(
  steps: Step[],
  stepId: string,
  flowId: string,
): Step[] {
  const { expandedIds, danglingIfThenIds } = expandIfThenBlockDeletions(steps, [
    stepId,
  ])
  for (const ifThenStepId of danglingIfThenIds) {
    logger.error({
      event: 'if-then-dangling-end-step',
      mutation: 'deleteStep',
      ifThenStepId,
      flowId,
    })
  }

  const target = steps.find((candidate) => candidate.id === stepId)
  if (target && isIfThenStep(target) && !isIfThenV2(target)) {
    const endStep = deriveIfThenV1EndStep(steps, target)
    for (const member of steps) {
      if (
        member.position >= target.position &&
        member.position <= endStep.position
      ) {
        expandedIds.add(member.id)
      }
    }
  }

  return steps.filter((candidate) => expandedIds.has(candidate.id))
}

function getStepsToInvalidate(
  steps: Step[],
  deletedIds: Set<string>,
): string[] {
  const stepsToInvalidate = []
  for (const s of steps) {
    if (hasStepReference(s.parameters, deletedIds)) {
      stepsToInvalidate.push(s.id)
    }
  }
  return stepsToInvalidate
}

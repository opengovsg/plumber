import { raw } from 'objection'

import { removeMrfSteps } from '@/apps/formsg/triggers/new-submission/remove-mrf-steps'
import { expandIfThenBlockDeletions } from '@/apps/toolbox/actions/if-then/infra/end-step-utils'
import {
  repairEndStepsOnDeleteStep,
  upgradeIfThenV1BlocksIfEnabled,
} from '@/apps/toolbox/common/validate-end-step'
import { hasStepReference } from '@/helpers/check-step-parameters'
import logger from '@/helpers/logger'
import Step from '@/models/step'

import type { MutationResolvers } from '../__generated__/types.generated'

function getStepsToInvalidate(steps: Step[], deletedIds: Set<string>) {
  const stepsToInvalidate = []
  for (const s of steps) {
    if (hasStepReference(s.parameters, deletedIds)) {
      stepsToInvalidate.push(s.id)
    }
  }
  return stepsToInvalidate
}

const deleteStep: MutationResolvers['deleteStep'] = async (
  _parent,
  params,
  context,
) => {
  const { input } = params
  if (input.ids.length === 0) {
    throw new Error('Nothing to delete')
  }

  return await Step.transaction(async (trx) => {
    await trx.raw('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;')
    // Include SELECTs in transaction too just in case there's concurrent modification.
    // Loads the whole flow's steps (not just the requested ids), since the
    // integrity logic below needs the full set to expand a marked if-then to
    // its block range and repair surviving blocks after the delete.
    let stepsBeforeDelete = await context.currentUser
      .withAccessibleSteps({ requiredRole: 'editor', trx })
      .withGraphFetched('flow')
      .whereIn(
        'steps.flow_id',
        Step.query(trx).select('flow_id').whereIn('id', input.ids),
      )
      .orderBy('steps.position', 'asc')
      .throwIfNotFound({
        message: 'Step not found. Refresh the page and try again.',
      })

    const steps = stepsBeforeDelete.filter((step) =>
      input.ids.includes(step.id),
    )

    // Confirm the request is single-pipe before deriving the flow, so
    // `steps[0].flow` is unambiguous (stepsBeforeDelete may span pipes if the
    // request mixed them).
    if (!steps.every((step) => step.flowId === steps[0].flowId)) {
      throw new Error('All steps to be deleted must be from the same pipe!')
    }

    const flow = steps[0].flow
    flow.assertNotUpdatedSince(input.flow.updatedAt, context.currentUser.id)

    // Opportunistically pins any other legacy if-then block, if the flag is
    // on for the pipe owner. Runs before the delete so derivation reflects
    // the true pre-delete state, excluding steps about to be deleted.
    await upgradeIfThenV1BlocksIfEnabled(
      trx,
      flow,
      stepsBeforeDelete,
      new Set(input.ids),
    )
    // Re-reads so any block just pinned above is reflected as V2 below.
    // IMPORTANT: otherwise the repair pass wouldn't see its own
    // freshly-written marker.
    stepsBeforeDelete = await flow
      .$relatedQuery('steps', trx)
      .orderBy('position', 'asc')

    const { expandedIds, danglingIfThenIds } = expandIfThenBlockDeletions(
      stepsBeforeDelete,
      input.ids,
    )
    for (const ifThenStepId of danglingIfThenIds) {
      logger.error({
        event: 'if-then-dangling-end-step',
        mutation: 'deleteStep',
        ifThenStepId,
        flowId: flow.id,
      })
    }
    const stepsToDelete = stepsBeforeDelete.filter((step) =>
      expandedIds.has(step.id),
    )

    //
    // ** IMPORTANT NOTE **
    // We only support deleting single trigger steps or contiguous action steps.
    //
    if (stepsToDelete.length === 1 && stepsToDelete[0].type === 'trigger') {
      const deletedStepId = stepsToDelete[0].id

      if (
        stepsToDelete[0].appKey === 'formsg' &&
        stepsToDelete[0].key === 'newSubmission'
      ) {
        await removeMrfSteps(flow.id, trx)
      }

      // check for steps whose parameters reference the deletedStepId
      const allSteps = await flow
        .$relatedQuery('steps', trx)
        .where('id', '!=', deletedStepId)
        .orderBy('position', 'asc')
      const stepsToInvalidate = getStepsToInvalidate(
        allSteps,
        new Set([deletedStepId]),
      )
      // invalidate steps that reference the deleted steps
      await Step.query(trx).findByIds(stepsToInvalidate).patch({
        status: 'incomplete',
      })

      // we delete and add a new trigger upon deletion to preserve past execution steps' context
      await steps[0].$query(trx).delete()
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
          (step, index) =>
            (index === 0 ||
              step.position === stepsToDelete[index - 1].position + 1) &&
            step.type === 'action',
        )
      ) {
        throw new Error('Must delete contiguous action steps!')
      }

      const stepIds = stepsToDelete.map((step) => step.id)

      // check for steps whose parameters reference the deletedStepId
      const allSteps = await flow
        .$relatedQuery('steps', trx)
        .whereNotIn('id', stepIds)
        .orderBy('position', 'asc')

      const stepsToInvalidate = getStepsToInvalidate(allSteps, new Set(stepIds))

      // invalidate steps that reference the deleted steps
      await Step.query(trx).findByIds(stepsToInvalidate).patch({
        status: 'incomplete',
      })

      /**
       * NOTE: do not delete execution steps
       * The deletion causes RDS CPU Utilisation to spike for high volume pipes.
       */
      // await Step.relatedQuery('executionSteps', trx).for(stepIds).delete()
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

    await repairEndStepsOnDeleteStep({ trx, flow, stepsBeforeDelete })

    await flow.patchLastUpdated({
      flowId: flow.id,
      updatedBy: context.currentUser.id,
      trx,
    })

    return await flow
      .$query(trx)
      .withGraphJoined('steps')
      .orderBy('steps.position', 'asc')
  })
}

export default deleteStep

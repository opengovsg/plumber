import { IStep } from '@plumber/types'

import { PartialModelObject, raw } from 'objection'

import { repairEndStepsOnReorder } from '@/apps/toolbox/common/validate-end-step'
import { BadUserInputError } from '@/errors/graphql-errors'
import logger from '@/helpers/logger'
import Step from '@/models/step'

import type { MutationResolvers } from '../__generated__/types.generated'

const updateStepPositions: MutationResolvers['updateStepPositions'] = async (
  _parent,
  params,
  context,
) => {
  const { input } = params
  const { stepPositions } = input

  if (
    !stepPositions.every(
      (
        obj: { id: string; position: number; type: IStep['type'] },
        index: number,
      ) =>
        (index === 0 ||
          obj.position === stepPositions[index - 1].position + 1) &&
        obj.type === 'action',
    )
  ) {
    throw new BadUserInputError(
      'Failed to update: must update contiguous action steps!',
    )
  }

  const stepIds = stepPositions.map(
    (obj: { id: string; position: number }) => obj.id,
  )

  const updatedPositions = await Step.transaction(async (trx) => {
    await trx.raw('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;')

    // Queries all steps of the impacted flow so block end steps can be
    // repaired after the reorder. The steps named in the request params
    // drive the position update itself.
    const allSteps = await context.currentUser
      .withAccessibleSteps({ requiredRole: 'editor', trx })
      .withGraphFetched('flow')
      .whereIn(
        'steps.flow_id',
        Step.query(trx).select('flow_id').whereIn('id', stepIds),
      )
      .orderBy('steps.position', 'asc')
      .throwIfNotFound()

    const stepsFromParams = allSteps.filter((step) => stepIds.includes(step.id))

    // Confirm the request is single-pipe before deriving the flow, so
    // `stepsFromParams[0].flow` is unambiguous (allSteps may span pipes if the
    // request mixed them).
    if (
      !stepsFromParams.every(
        (step) => step.flowId === stepsFromParams[0].flowId,
      )
    ) {
      throw new BadUserInputError(
        'Failed to update: steps must be from the same pipe!',
      )
    }

    const flow = stepsFromParams[0].flow
    if (flow.active) {
      throw new BadUserInputError(
        'Pipe is active. Cannot update step in active pipe!',
      )
    }

    flow.assertNotUpdatedSince(input.flow.updatedAt, context.currentUser.id)

    const foundStepIds = stepsFromParams.map((step) => step.id)
    const missingStepIds = stepIds.filter(
      (id: string) => !foundStepIds.includes(id),
    )

    if (missingStepIds.length > 0) {
      throw new BadUserInputError('Failed to update: steps were not found')
    }

    // since we are only updating actions based on their groups
    // e.g., non grouped steps, or actions within an if-then branch
    // validate that the step positions are not out of bounds
    const minPosition = stepsFromParams[0].position
    const maxPosition = stepsFromParams[stepsFromParams.length - 1].position
    if (
      stepPositions.some((obj) => obj.position > maxPosition) ||
      stepPositions.some((obj) => obj.position < minPosition)
    ) {
      throw new BadUserInputError(
        'Failed to update: step positions are out of bounds.',
      )
    }

    // Patch each step individually with its new position
    for (const stepPosition of stepPositions) {
      const patchData: PartialModelObject<Step> = {
        position: stepPosition.position,
      }
      if (stepPosition.config) {
        patchData.config = stepPosition.config.approval
          ? raw(`jsonb_set(config, '{approval}', ?::jsonb, true)`, [
              JSON.stringify(stepPosition.config?.approval),
            ])
          : raw(`config - 'approval'`)
      }
      await Step.query(trx).findById(stepPosition.id).patch(patchData)
    }

    await repairEndStepsOnReorder({
      trx,
      flow,
      preSteps: allSteps,
      newPositions: stepPositions,
    })

    // Update the flow's lastUpdatedAt timestamp
    const updatedFlow = await flow
      .$query(trx)
      .patchAndFetch({
        updatedAt: new Date().toISOString(),
      })
      .withGraphFetched('steps')
      .orderBy('steps.position', 'asc')

    // sanity check that all step positions are contiguous
    const contiguousPositions = updatedFlow.steps.map((step) => step.position)
    if (
      !contiguousPositions.every((position, index) => position === index + 1)
    ) {
      logger.error({
        message: 'Updated positions are no longer contiguous',
        stepPositions,
        flowId: flow.id,
      })
      throw new BadUserInputError(
        'Failed to update: updated positions are no longer contiguous',
      )
    }

    return updatedFlow
  })

  return updatedPositions
}

export default updateStepPositions

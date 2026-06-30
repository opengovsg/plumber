import { IStep } from '@plumber/types'

import { PartialModelObject, raw } from 'objection'

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
  const { stepPositions, auxiliaryChanges } = input

  // stepPositions repositions a contiguous run of action steps. Jump-target
  // changes to if-thens outside that run travel separately in auxiliaryChanges.
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

    const steps = await context.currentUser
      .withAccessibleSteps({ requiredRole: 'editor', trx })
      .withGraphFetched('flow')
      .whereIn('steps.id', stepIds)
      .orderBy('steps.position', 'asc')
      .throwIfNotFound()

    if (steps[0].flow.active) {
      throw new BadUserInputError(
        'Pipe is active. Cannot update step in active pipe!',
      )
    }

    const flow = steps[0].flow
    flow.assertNotUpdatedSince(input.flow.updatedAt, context.currentUser.id)

    const foundStepIds = steps.map((step) => step.id)
    const missingStepIds = stepIds.filter(
      (id: string) => !foundStepIds.includes(id),
    )

    if (missingStepIds.length > 0) {
      throw new BadUserInputError('Failed to update: steps were not found')
    }

    // since we are only updating actions based on their groups
    // e.g., non grouped steps, or actions within an if-then branch
    // validate that the step positions are not out of bounds
    const minPosition = steps[0].position
    const maxPosition = steps[steps.length - 1].position
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
      // Maintain an if-then branch's step to jump to. Omitted => leave the
      // existing parameters untouched. A string sets the target; null stores the
      // "stop" sentinel (last branch of the last block). Both keep the key
      // present, so execution reads the pointer instead of the legacy scan.
      if (stepPosition.stepIdToJumpTo !== undefined) {
        patchData.parameters = raw(
          `jsonb_set(parameters, '{stepIdToJumpTo}', ?::jsonb, true)`,
          [JSON.stringify(stepPosition.stepIdToJumpTo)],
        )
      }
      await Step.query(trx).findById(stepPosition.id).patch(patchData)
    }

    // Apply auxiliary if-then jump-target changes: steps outside the
    // repositioned run whose stepIdToJumpTo must move in the same transaction
    // (e.g. reordering an after-block region repoints the block's last branch).
    const auxIfThenChanges = (auxiliaryChanges ?? [])
      .map((change) => change.ifThen)
      .filter((ifThen): ifThen is NonNullable<typeof ifThen> => !!ifThen)
    if (auxIfThenChanges.length > 0) {
      const auxStepIds = auxIfThenChanges.map((change) => change.stepId)
      const auxSteps = await context.currentUser
        .withAccessibleSteps({ requiredRole: 'editor', trx })
        .whereIn('steps.id', auxStepIds)
        .throwIfNotFound()

      // Authz + same-flow guard: every referenced step must be accessible and
      // belong to the flow being edited, so a change can't reach into another.
      const inFlowAuxStepIds = new Set(
        auxSteps
          .filter((step) => step.flowId === flow.id)
          .map((step) => step.id),
      )
      if (auxStepIds.some((id) => !inFlowAuxStepIds.has(id))) {
        throw new BadUserInputError(
          'Failed to update: auxiliary change steps were not found in this flow',
        )
      }

      for (const change of auxIfThenChanges) {
        await Step.query(trx)
          .findById(change.stepId)
          .patch({
            parameters: raw(
              `jsonb_set(parameters, '{stepIdToJumpTo}', ?::jsonb, true)`,
              [JSON.stringify(change.stepIdToJumpTo)],
            ),
          })
      }
    }

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

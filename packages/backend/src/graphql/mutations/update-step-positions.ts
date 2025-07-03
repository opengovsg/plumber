import { IStep } from '@plumber/types'

import { BadUserInputError } from '@/errors/graphql-errors'
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

    const steps = await context.currentUser
      .$relatedQuery('steps', trx)
      .withGraphFetched('flow')
      .whereIn('steps.id', stepIds)
      .orderBy('steps.position', 'asc')
      .throwIfNotFound()

    if (steps[0].flow.active) {
      throw new BadUserInputError(
        'Pipe is active. Cannot update step in active pipe!',
      )
    }

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

    const flow = steps[0].flow

    // Patch each step individually with its new position
    for (const stepPosition of stepPositions) {
      await Step.query(trx).findById(stepPosition.id).patch({
        position: stepPosition.position,
      })
    }

    // Update the flow's lastUpdatedAt timestamp
    const updatedFlow = await flow
      .$query(trx)
      .patchAndFetch({
        updatedAt: new Date().toISOString(),
      })
      .withGraphFetched('steps')
      .orderBy('steps.position', 'asc')

    return updatedFlow.steps
  })

  return updatedPositions
}

export default updateStepPositions

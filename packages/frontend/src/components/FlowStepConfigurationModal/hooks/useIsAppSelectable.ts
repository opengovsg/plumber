import { IStep } from '@plumber/types'

import { useContext } from 'react'

import { StepsToDisplayContext } from '@/contexts/StepsToDisplay'
import { isStepWithinIfThenBlock, TOOLBOX_ACTIONS } from '@/helpers/toolbox'

/**
 * Helper function to check if Delay action should be selectable
 *
 * Delay should only be selectable if:
 * - We are not inside a for-each action.
 *
 */
function isDelaySelectable({
  hasForEach,
  groupedSteps,
  step,
  prevStepId,
}: {
  hasForEach: boolean
  groupedSteps: IStep[][]
  step?: IStep
  prevStepId?: string
}) {
  if (!hasForEach) {
    return true
  }
  const isStepWithinForEach = groupedSteps.flat().some((groupedStep) => {
    if (step?.id === groupedStep.id || prevStepId === groupedStep.id) {
      return true
    }
    return false
  })
  return !isStepWithinForEach
}

export const useIsAppSelectable = ({
  isLastStep,
  step,
  prevStepId,
}: {
  isLastStep: boolean
  step?: IStep
  prevStepId?: string
}): Record<string, boolean> => {
  const { groupedSteps, regionList } = useContext(StepsToDisplayContext)

  const hasIfThen = groupedSteps.some((group) =>
    group.some((step) => step.key === TOOLBOX_ACTIONS.IfThen),
  )

  const hasForEach = groupedSteps.some((group) =>
    group.some((step) => step.key === TOOLBOX_ACTIONS.ForEach),
  )

  // The step the modal is anchored at: the empty step being configured, or the
  // step we're adding after.
  const anchorStepId = step?.id ?? prevStepId
  const isWithinIfThenBlock = isStepWithinIfThenBlock(regionList, anchorStepId)

  return {
    /**
     * If-then should only be selectable if we are not inside an if-then
     * branch — no nesting if-thens. It is otherwise addable anywhere, even
     * mid-flow or inside a for-each body: an inserted block exits to the step
     * that followed the anchor step (see useIfThenInitializer), and an if-then
     * elsewhere in the flow no longer disables it (blocks can follow one
     * another, chained via each branch's step to jump to).
     */
    [TOOLBOX_ACTIONS.IfThen]: !isWithinIfThenBlock,
    /**
     * For-each should only be selectable if:
     * - We're the last step.
     * - There's no other for-each action
     * - There's no other if-then action
     */
    [TOOLBOX_ACTIONS.ForEach]: isLastStep && !hasIfThen && !hasForEach,
    delay: isDelaySelectable({ hasForEach, groupedSteps, step, prevStepId }),
  }
}

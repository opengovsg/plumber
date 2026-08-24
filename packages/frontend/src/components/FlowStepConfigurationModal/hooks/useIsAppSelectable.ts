import { IStep } from '@plumber/types'
import { useContext } from 'react'

import { BranchContext } from '@/components/FlowStepGroup/Content/IfThen/BranchContext'
import { NESTED_IFTHEN_FEATURE_FLAG } from '@/config/flags'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'
import { StepsToDisplayContext } from '@/contexts/StepsToDisplay'
import { TOOLBOX_ACTIONS } from '@/helpers/toolbox'

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

/**
 * Helper function to check if If-then action should be selectable; supports edge
 * case in ChooseEvent component.
 *
 * If-then should only be selectable if:
 * - We're the last step.
 * - We are not inside a branch (unless we're whitelisted for nested
 *   branches via LD).
 *
 * Using many consts as purpose of the conditions may not be immediately
 * apparent.
 */
function isIfThenSelectable({
  depth,
  hasIfThen,
  isLastStep,
  getFlagValue,
}: {
  depth: number
  hasIfThen: boolean
  isLastStep: boolean
  getFlagValue: (
    flagKey: string,
    defaultValue?: boolean | string,
  ) => boolean | string
}) {
  if (!isLastStep || hasIfThen) {
    return false
  }

  const canUseNestedBranch = getFlagValue(NESTED_IFTHEN_FEATURE_FLAG, false)
  if (canUseNestedBranch) {
    return true
  }

  const isNestedBranch = depth > 0

  return !isNestedBranch
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
  const { depth } = useContext(BranchContext)
  const { groupedSteps } = useContext(StepsToDisplayContext)
  const { getFlagValue } = useContext(LaunchDarklyContext)

  const hasIfThen = groupedSteps.some((group) =>
    group.some((step) => step.key === TOOLBOX_ACTIONS.IfThen),
  )

  const hasForEach = groupedSteps.some((group) =>
    group.some((step) => step.key === TOOLBOX_ACTIONS.ForEach),
  )

  return {
    [TOOLBOX_ACTIONS.IfThen]: isIfThenSelectable({
      depth,
      hasIfThen,
      isLastStep,
      getFlagValue,
    }),
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

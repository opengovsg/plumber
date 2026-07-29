import { IStep } from '@plumber/types'

import { useContext } from 'react'

import { BranchContext } from '@/components/FlowStepGroup/Content/IfThen/BranchContext'
import { NESTED_IFTHEN_FEATURE_FLAG } from '@/config/flags'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'
import { StepsToDisplayContext } from '@/contexts/StepsToDisplay'
import { isForEachStep, TOOLBOX_ACTIONS } from '@/helpers/toolbox'
import { useIfThenV2Enabled } from '@/hooks/useIfThenV2Enabled'

import {
  type AnchorPlacement,
  isAnchorInsideForEachBody,
  isAnchorInsideIfThenBlock,
} from '../helpers/anchor-placement'

/**
 * The reason every unselectable action has carried since the toolbox shipped:
 * back then the only rules were "last step only", so it doubles as the default
 * for an action the hook says nothing about.
 */
export const LAST_STEP_ONLY_REASON = 'This can only be used as the last step'

/**
 * An if-then block runs the steps it contains, so an if-then among them would
 * be a nested branch — which the block model does not support.
 */
const IF_THEN_INSIDE_BLOCK_REASON =
  'You cannot add an If-then inside another If-then'

export interface AppSelectability {
  isSelectable: boolean
  disabledReason: string
}

function selectability(
  isSelectable: boolean,
  disabledReason: string = LAST_STEP_ONLY_REASON,
): AppSelectability {
  return { isSelectable, disabledReason }
}

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

/**
 * Selectability under the if-then V2 block model: since a block has a bounded
 * extent, an if-then is no longer forced to be the flow's last or only step,
 * leaving nesting as the sole restriction. For-each has no such extent, so it
 * still swallows every later step and must stay last.
 */
function getIfThenV2Selectability({
  isLastStep,
  anchorPlacement,
  anchorStep,
  actionSteps,
  groupingActions,
}: {
  isLastStep: boolean
  anchorPlacement?: AnchorPlacement
  anchorStep?: IStep
  actionSteps: IStep[]
  groupingActions: Set<string>
}): Record<string, AppSelectability> {
  const isInsideIfThenBlock = isAnchorInsideIfThenBlock({
    anchorPlacement,
    anchorStep,
    actionSteps,
    groupingActions,
  })
  const hasForEach = actionSteps.some(isForEachStep)

  return {
    [TOOLBOX_ACTIONS.IfThen]: selectability(
      !isInsideIfThenBlock,
      IF_THEN_INSIDE_BLOCK_REASON,
    ),
    [TOOLBOX_ACTIONS.ForEach]: selectability(
      isLastStep && !hasForEach && !isInsideIfThenBlock,
    ),
    delay: selectability(
      !isAnchorInsideForEachBody({ anchorStep, actionSteps, groupingActions }),
    ),
  }
}

export const useIsAppSelectable = ({
  isLastStep,
  step,
  prevStepId,
  anchorPlacement,
}: {
  isLastStep: boolean
  step?: IStep
  prevStepId?: string
  anchorPlacement?: AnchorPlacement
}): Record<string, AppSelectability> => {
  const { depth } = useContext(BranchContext)
  const { groupedSteps, actionStepsToDisplay, groupingActions } = useContext(
    StepsToDisplayContext,
  )
  const { getFlagValue } = useContext(LaunchDarklyContext)
  const { isEnabled: isIfThenV2Enabled, isLoading: isIfThenV2Loading } =
    useIfThenV2Enabled()

  const hasIfThen = groupedSteps.some((group) =>
    group.some((step) => step.key === TOOLBOX_ACTIONS.IfThen),
  )

  const hasForEach = groupedSteps.some((group) =>
    group.some((step) => step.key === TOOLBOX_ACTIONS.ForEach),
  )

  // While the flag is resolving, keep the old rules. Selectability must not
  // loosen out from under an already-open toolbox.
  if (isIfThenV2Enabled && !isIfThenV2Loading) {
    return getIfThenV2Selectability({
      isLastStep,
      anchorPlacement,
      // A previous step that is the trigger resolves to nothing, which is
      // correct: a trigger is inside no block.
      anchorStep:
        step ??
        actionStepsToDisplay.find((actionStep) => actionStep.id === prevStepId),
      actionSteps: actionStepsToDisplay,
      groupingActions: groupingActions ?? new Set<string>(),
    })
  }

  return {
    [TOOLBOX_ACTIONS.IfThen]: selectability(
      isIfThenSelectable({
        depth,
        hasIfThen,
        isLastStep,
        getFlagValue,
      }),
    ),
    /**
     * For-each should only be selectable if:
     * - We're the last step.
     * - There's no other for-each action
     * - There's no other if-then action
     */
    [TOOLBOX_ACTIONS.ForEach]: selectability(
      isLastStep && !hasIfThen && !hasForEach,
    ),
    delay: selectability(
      isDelaySelectable({ hasForEach, groupedSteps, step, prevStepId }),
    ),
  }
}

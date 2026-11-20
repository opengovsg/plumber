import { IStep } from '@plumber/types'
import { useContext } from 'react'

import { StepsToDisplayContext } from '@/contexts/StepsToDisplay'
import { isForEachStep, TOOLBOX_ACTIONS } from '@/helpers/toolbox'

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
export const IF_THEN_INSIDE_BLOCK_REASON =
  'You cannot add an If block inside another If block'

export const FOR_EACH_INSIDE_BLOCK_REASON =
  'Repeat cannot be used in an If block'

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
 * Selectability under the if-then V2 block model: since a block has a bounded
 * extent, an if-then is no longer forced to be the flow's last or only step,
 * leaving nesting as the sole restriction. For-each has no such extent, so it
 * still swallows every later step and must stay last.
 */
export function getIfThenV2Selectability({
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
      isInsideIfThenBlock
        ? FOR_EACH_INSIDE_BLOCK_REASON
        : LAST_STEP_ONLY_REASON,
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
  const { actionStepsToDisplay, groupingActions } = useContext(
    StepsToDisplayContext,
  )

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

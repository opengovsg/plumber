import { IFlow, IStep } from '@plumber/types'

import { useContext } from 'react'
import { LDFlagSet } from 'launchdarkly-js-client-sdk'

import { BranchContext } from '@/components/FlowStepGroup/Content/IfThen/BranchContext'
import { NESTED_IFTHEN_FEATURE_FLAG } from '@/config/flags'
import { EditorContext } from '@/contexts/Editor'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'
import { TOOLBOX_ACTIONS } from '@/helpers/toolbox'

/**
 * Helper function to check if Delay action should be selectable
 *
 * Delay should only be selectable if:
 * - We are not inside a for-each action.
 *
 */
function isDelaySelectable({
  flow,
  step,
  prevStepId,
}: {
  flow: IFlow
  step?: IStep
  prevStepId?: string
}) {
  const forEachStepPosition = flow?.steps.find(
    (s) => s.key === TOOLBOX_ACTIONS.ForEach,
  )?.position

  let prevStepPosition = null
  if (step) {
    prevStepPosition = step.position
  } else if (prevStepId) {
    prevStepPosition = flow?.steps?.find((s) => s.id === prevStepId)?.position
  }

  let isDelaySelectable: boolean
  if (!forEachStepPosition) {
    isDelaySelectable = true
  } else if (forEachStepPosition && prevStepPosition) {
    isDelaySelectable = prevStepPosition < forEachStepPosition
  } else {
    isDelaySelectable = false
  }

  return isDelaySelectable
}

/**
 * Helper function to check if For-each action should be selectable; supports edge
 * case in ChooseEvent component.
 *
 * For-each should only be selectable if:
 * - We're the last step.
 * - We are not inside a for-each action.
 * - We are not inside an if-then action.
 * - There is no if-then action in the flow,
 *
 * Using many consts as purpose of the conditions may not be immediately
 * apparent.
 */
function isForEachSelectable({
  flow,
  hasIfThen,
  isLastStep,
}: {
  flow: IFlow
  hasIfThen: boolean
  isLastStep: boolean
}) {
  const hasForEach = flow?.steps?.some(
    (step: IStep) => step.key === TOOLBOX_ACTIONS.ForEach,
  )

  if (hasForEach || hasIfThen || !isLastStep) {
    return false
  }

  return true
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
  ldFlags,
}: {
  depth: number
  hasIfThen: boolean
  isLastStep: boolean
  ldFlags: LDFlagSet | null
}) {
  if (!isLastStep || hasIfThen) {
    return false
  }

  const canUseNestedBranch = ldFlags?.[NESTED_IFTHEN_FEATURE_FLAG] ?? false
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
}) => {
  const { depth } = useContext(BranchContext)
  const { flow, hasIfThen } = useContext(EditorContext)
  const { flags: ldFlags } = useContext(LaunchDarklyContext)

  return {
    [TOOLBOX_ACTIONS.IfThen]: isIfThenSelectable({
      depth,
      hasIfThen,
      isLastStep,
      ldFlags,
    }),
    [TOOLBOX_ACTIONS.ForEach]: isForEachSelectable({
      flow,
      hasIfThen,
      isLastStep,
    }),
    delay: isDelaySelectable({ flow, step, prevStepId }),
  }
}

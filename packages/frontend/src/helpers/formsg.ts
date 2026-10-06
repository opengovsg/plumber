import { IStep, IStepApprovalBranch, IStepApprovalConfig } from '@plumber/types'

import get from 'lodash/get'

import { getItem, setItem } from '@/helpers/storage'
import { isOnlyContinueIfStep } from '@/helpers/toolbox'

export const MRF_ACTION_KEY = 'mrfSubmission'
export const FORMSG_APP_KEY = 'formsg'
export const FORMSG_TRIGGER_KEY = 'newSubmission'

/**
 * One-time hint shown the first time a user switches to the "If rejected" tab
 * on an MRF approval step, clarifying that the approval is configured in FormSG
 * and that the Plumber connection is read-only. Persisted per-browser.
 */
export const MRF_APPROVAL_HINT_STORAGE_KEY = 'mrf.approvalHint.dismissed'

export function hasSeenMrfApprovalHint(): boolean {
  return getItem(MRF_APPROVAL_HINT_STORAGE_KEY) === 'true'
}

export function dismissMrfApprovalHint(): void {
  setItem(MRF_APPROVAL_HINT_STORAGE_KEY, 'true')
}

/**
 * An "Only continue if" step cannot stop an MRF form's respondents: each
 * respondent's submission is a separate FormSG webhook that enters its own
 * subtrigger step, bypassing any halted execution. We warn when an "Only
 * continue if" sits before a downstream subtrigger, where a user is most likely
 * to assume it gates the rest of the workflow.
 */
export function shouldWarnMrfOnlyContinueIf({
  step,
  mrfSteps,
}: {
  step: IStep
  mrfSteps: IStep[]
}): boolean {
  return (
    isOnlyContinueIfStep(step) &&
    mrfSteps.some((mrfStep) => mrfStep.position > step.position)
  )
}

export function isMrfApprovalStep(step: IStep): boolean {
  return (
    step.appKey === FORMSG_APP_KEY &&
    step.key === MRF_ACTION_KEY &&
    !!get(step.parameters, 'mrf.approvalField', false)
  )
}

/**
 * Keeps only the steps on the approval path the user has selected. Selecting
 * "If rejected" on an approval step hides every later step that is not in that
 * step's reject path.
 */
export function filterStepsByApprovalBranch<T extends IStep>(
  steps: T[],
  approvalBranches: Record<string, IStepApprovalBranch>,
): T[] {
  let firstRejectBranchStepId: string | null = null
  return steps.filter((step) => {
    if (
      firstRejectBranchStepId != null &&
      step.config?.approval?.stepId !== firstRejectBranchStepId
    ) {
      return false
    }

    if (!firstRejectBranchStepId && approvalBranches[step.id] === 'reject') {
      firstRejectBranchStepId = step.id
      return true
    }

    if (!step.config?.approval) {
      return true
    }

    const approvalConfigStepId = step.config?.approval?.stepId
    const approvalConfigBranch = step.config?.approval?.branch

    return approvalBranches[approvalConfigStepId] === approvalConfigBranch
  })
}

/**
 * Helper function to check if the step to be created is within an MRF approval branch
 */
export function getMrfApprovalConfig({
  previousStep,
  approvalBranches,
}: {
  previousStep: IStep
  approvalBranches: Record<string, IStepApprovalBranch>
}): IStepApprovalConfig | undefined {
  /**
   * If step to be created is a trigger, return undefined always
   */
  if (!previousStep) {
    return undefined
  }

  /**
   * If previous step is an action step within an approval branch,
   * return the same approval branch and step id
   */
  if (
    previousStep.config?.approval?.branch &&
    previousStep.config?.approval?.stepId
  ) {
    return previousStep.config?.approval
  }

  /**
   * If previous step is an approval step and is set to reject, return the reject branch
   */
  if (approvalBranches[previousStep.id] === 'reject') {
    return {
      branch: 'reject',
      stepId: previousStep.id,
    }
  }

  /**
   * Default: undefined
   */
  return undefined
}

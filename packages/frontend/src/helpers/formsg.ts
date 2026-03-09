import { IStep, IStepApprovalBranch, IStepApprovalConfig } from '@plumber/types'

export const MRF_ACTION_KEY = 'mrfSubmission'
export const FORMSG_APP_KEY = 'formsg'
export const FORMSG_TRIGGER_KEY = 'newSubmission'

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

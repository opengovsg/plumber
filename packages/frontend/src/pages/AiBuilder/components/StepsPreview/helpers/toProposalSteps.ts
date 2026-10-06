import type { IFlowStepsAction, IFlowStepsTrigger } from '@plumber/types'

import type { PreviewStep } from './previewItems'

/**
 * Turns a proposal's trigger and actions into preview steps. An approval stage
 * gets an id and its rejected-path actions point at it through
 * `config.approval`, so the preview filters them the way the editor does.
 */
export function toProposalSteps(
  trigger: IFlowStepsTrigger | undefined,
  actions: IFlowStepsAction[],
): PreviewStep[] {
  let approvalStageId: string | undefined

  return [...(trigger ? [trigger] : []), ...actions].map((step, index) => {
    const position = index + 1
    const { isApproval, approvalBranch } = step as Partial<IFlowStepsAction>

    if (isApproval) {
      approvalStageId = `proposal-step-${position}`
      return { ...step, id: approvalStageId, position } as PreviewStep
    }

    if (approvalBranch === 'reject' && approvalStageId) {
      return {
        ...step,
        position,
        config: {
          ...(step as IFlowStepsAction).config,
          approval: { branch: 'reject', stepId: approvalStageId },
        },
      } as unknown as PreviewStep
    }

    return { ...step, position } as PreviewStep
  })
}

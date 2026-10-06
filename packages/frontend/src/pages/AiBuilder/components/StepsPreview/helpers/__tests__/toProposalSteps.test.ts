import type { IFlowStepsAction, IFlowStepsTrigger } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import { filterStepsByApprovalBranch } from '@/helpers/formsg'

import { isApprovalPreviewStep } from '../previewItems'
import { toProposalSteps } from '../toProposalSteps'

const trigger: IFlowStepsTrigger = {
  type: 'trigger',
  appKey: 'formsg',
  key: 'newSubmission',
  description: '',
}

function action(
  key: string,
  extra: Partial<IFlowStepsAction> = {},
): IFlowStepsAction {
  return {
    type: 'action',
    appKey: key === 'mrfSubmission' ? 'formsg' : 'postman',
    key,
    description: '',
    config: { stepName: key },
    ...extra,
  }
}

const approvalProposal = [
  action('mrfSubmission', { isApproval: true }),
  action('approvedEmail'),
  action('rejectedEmail', { approvalBranch: 'reject' }),
]

describe('toProposalSteps', () => {
  it('numbers the trigger and actions in order', () => {
    const steps = toProposalSteps(trigger, approvalProposal)

    expect(steps.map((step) => step.position)).toEqual([1, 2, 3, 4])
  })

  it('marks the approval stage and ties the rejected action to it', () => {
    const steps = toProposalSteps(trigger, approvalProposal)

    expect(isApprovalPreviewStep(steps[1])).toBe(true)
    expect(steps[3].config?.approval).toEqual({
      branch: 'reject',
      stepId: steps[1].id,
    })
  })

  it('keeps the action name when it adds the approval config', () => {
    const steps = toProposalSteps(trigger, approvalProposal)

    expect(steps[3].config?.stepName).toBe('rejectedEmail')
  })

  it('ties a rejected action to the latest approval stage before it', () => {
    const steps = toProposalSteps(trigger, [
      action('mrfSubmission', { isApproval: true }),
      action('rejectedEmail', { approvalBranch: 'reject' }),
      action('mrfSubmission', { isApproval: true }),
      action('rejectedSms', { approvalBranch: 'reject' }),
    ])

    expect(steps[2].config?.approval?.stepId).toBe(steps[1].id)
    expect(steps[4].config?.approval?.stepId).toBe(steps[3].id)
  })

  it('leaves a proposal without approval stages untouched', () => {
    const steps = toProposalSteps(trigger, [action('approvedEmail')])

    expect(steps[1].id).toBeUndefined()
    expect(steps[1].config?.approval).toBeUndefined()
  })

  it('shows the approved path first and the rejected path on request', () => {
    const steps = toProposalSteps(trigger, approvalProposal)
    const approvalId = steps[1].id as string
    const keys = (branch: 'approve' | 'reject') =>
      filterStepsByApprovalBranch(steps, { [approvalId]: branch }).map(
        (step) => step.key,
      )

    expect(keys('approve')).toEqual([
      'newSubmission',
      'mrfSubmission',
      'approvedEmail',
    ])
    expect(keys('reject')).toEqual([
      'newSubmission',
      'mrfSubmission',
      'rejectedEmail',
    ])
  })
})

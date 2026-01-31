import { IStep } from '@plumber/types'

import { useContext } from 'react'

import { MrfContext } from '@/contexts/MrfContext'
import { FlowStep } from '@/exports/components'
import { useStepMetadata } from '@/hooks/useStepMetadata'

import { ApproveReject } from '../../FlowStep/components/ApproveReject'

import { AddStepButton } from './AddStepButton'
import { DisabledFlowStep } from './DisabledFlowStep'

export default function FlowStepWithAddButton({
  step,
  isLastStep,
  isNested,
  allowReorder,
  addButtonProps: {
    isHidden = false,
    isDisabled = false,
    showEmptyAction = false,
  },
}: {
  step: IStep
  isLastStep: boolean
  isNested?: boolean
  stepsBeforeGroup: IStep[]
  groupedSteps: IStep[][]
  allowReorder: boolean
  addButtonProps: {
    isHidden: boolean
    isDisabled: boolean
    showEmptyAction: boolean
  }
}) {
  const { approvalBranches, disabledMrfStepToDisplay } = useContext(MrfContext)
  const { isApprovalStep, approvalBranch } = useStepMetadata(step)
  const approvalBranchForAddStep = approvalBranch ?? approvalBranches[step.id]

  const shouldShowDisabledMrfStep = isLastStep && disabledMrfStepToDisplay

  return (
    <>
      <FlowStep
        step={step}
        isLastStep={isLastStep}
        isNested={isNested}
        // only allow reordering if there are more than 1 action steps
        allowReorder={allowReorder}
      />
      {isApprovalStep && <ApproveReject stepId={step.id} />}
      <AddStepButton
        isLastStep={isLastStep}
        step={step}
        isHidden={isHidden}
        isDisabled={isDisabled}
        showEmptyAction={showEmptyAction}
        approvalBranch={approvalBranchForAddStep}
      />
      {shouldShowDisabledMrfStep && (
        <DisabledFlowStep
          step={disabledMrfStepToDisplay}
          tooltipText={
            'This step will only happen if the previous MRF step is approved'
          }
        />
      )}
    </>
  )
}

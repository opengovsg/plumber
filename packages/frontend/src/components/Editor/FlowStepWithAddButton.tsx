import { IStep } from '@plumber/types'

import { FlowStep } from '@/exports/components'
import { useStepMetadata } from '@/hooks/useStepMetadata'

import { ApproveReject } from '../FlowStep/components/ApproveReject'

import { AddStepButton } from './AddStepButton'

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
  const { isApprovalStep } = useStepMetadata(step)

  return (
    <>
      <FlowStep
        step={step}
        isLastStep={isLastStep}
        isNested={isNested}
        // only allow reordering if there are more than 1 action steps
        allowReorder={allowReorder}
      />
      {isApprovalStep && <ApproveReject />}
      <AddStepButton
        isLastStep={isLastStep}
        step={step}
        isHidden={isHidden}
        isDisabled={isDisabled}
        showEmptyAction={showEmptyAction}
      />
    </>
  )
}

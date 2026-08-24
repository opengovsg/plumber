import { IStep } from '@plumber/types'
import { useContext } from 'react'

import { EditorContext } from '@/contexts/Editor'
import { FlowStep } from '@/exports/components'

import { HoverAddStepButton } from '../Content/IfThen/HoverAddStepButton'

interface GroupStepWithAddButtonProps {
  step: IStep
  canAddStep: boolean
  isLastStep: boolean
  isOverlay?: boolean
  allowReorder?: boolean
  showEmptyAction?: boolean
  canChildStepsReorder?: boolean
}

export default function GroupStepWithAddButton(
  props: GroupStepWithAddButtonProps,
) {
  const {
    step,
    canAddStep,
    isLastStep,
    isOverlay,
    allowReorder,
    showEmptyAction,
    canChildStepsReorder,
  } = props
  const { isDrawerOpen, readOnly } = useContext(EditorContext)

  return (
    <>
      <FlowStep
        step={step}
        // branch steps are always nested
        isNested={true}
        isLastStep={isLastStep}
        allowReorder={allowReorder}
        canChildStepsReorder={canChildStepsReorder}
      />
      {!isOverlay && (
        <HoverAddStepButton
          isDisabled={readOnly || !canAddStep}
          isDrawerOpen={isDrawerOpen}
          isLastStep={isLastStep}
          prevStep={step}
          showEmptyAction={showEmptyAction}
          step={step}
          allowReorder={allowReorder}
          canChildStepsReorder={canChildStepsReorder}
        />
      )}
    </>
  )
}

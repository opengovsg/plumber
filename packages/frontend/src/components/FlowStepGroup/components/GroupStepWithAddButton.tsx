import { IStep } from '@plumber/types'
import { useContext } from 'react'

import { EditorContext } from '@/contexts/Editor'
import { FlowStep } from '@/exports/components'
import { isOnlyContinueIfStep } from '@/helpers/toolbox'

import { HoverAddStepButton } from '../Content/IfThen/HoverAddStepButton'
import OnlyContinueIf from '../Content/OnlyContinueIf'

interface GroupStepWithAddButtonProps {
  step: IStep
  canAddStep: boolean
  isLastStep: boolean
  isOverlay?: boolean
  allowReorder?: boolean
  showEmptyAction?: boolean
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
  } = props
  const { isDrawerOpen, readOnly } = useContext(EditorContext)

  return (
    <>
      {isOnlyContinueIfStep(step) ? (
        <OnlyContinueIf
          step={step}
          isLastStep={isLastStep}
          isNested={true}
          allowReorder={allowReorder}
        />
      ) : (
        <FlowStep
          step={step}
          // branch steps are always nested
          isNested={true}
          isLastStep={isLastStep}
          allowReorder={allowReorder}
        />
      )}
      {!isOverlay && (
        <HoverAddStepButton
          isDisabled={readOnly || !canAddStep}
          isDrawerOpen={isDrawerOpen}
          isLastStep={isLastStep}
          prevStep={step}
          showEmptyAction={showEmptyAction}
          step={step}
          allowReorder={allowReorder}
        />
      )}
    </>
  )
}

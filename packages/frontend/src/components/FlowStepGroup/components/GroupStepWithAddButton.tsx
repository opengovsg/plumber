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
  canChildStepsReorder?: boolean
  /** Draw an only-continue-if step as a CONTINUE IF condition block. */
  asConditionBlock?: boolean
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
    asConditionBlock = false,
  } = props
  const { isDrawerOpen, readOnly } = useContext(EditorContext)

  return (
    <>
      {asConditionBlock && isOnlyContinueIfStep(step) ? (
        <OnlyContinueIf
          step={step}
          isLastStep={isLastStep}
          isNested={true}
          allowReorder={allowReorder}
          canChildStepsReorder={canChildStepsReorder}
        />
      ) : (
        <FlowStep
          step={step}
          // branch steps are always nested
          isNested={true}
          isLastStep={isLastStep}
          allowReorder={allowReorder}
          canChildStepsReorder={canChildStepsReorder}
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
          canChildStepsReorder={canChildStepsReorder}
        />
      )}
    </>
  )
}

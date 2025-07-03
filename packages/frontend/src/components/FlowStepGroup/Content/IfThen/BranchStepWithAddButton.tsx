import { IStep } from '@plumber/types'

import { useContext } from 'react'

import { EditorContext } from '@/contexts/Editor'
import { FlowStep } from '@/exports/components'
import { TOOLBOX_ACTIONS, TOOLBOX_APP_KEY } from '@/helpers/toolbox'

import { HoverAddStepButton } from './HoverAddStepButton'

interface BranchStepWithAddButtonProps {
  step: IStep
  canAddStep: boolean
  isLastStep: boolean
  isOverlay?: boolean
}

export default function BranchStepWithAddButton(
  props: BranchStepWithAddButtonProps,
) {
  const { step, canAddStep, isLastStep, isOverlay } = props
  const { isDrawerOpen, readOnly } = useContext(EditorContext)

  // cannot delete the condition step
  const isDeletable =
    step.appKey !== TOOLBOX_APP_KEY && step.key !== TOOLBOX_ACTIONS.IfThen

  return (
    <>
      <FlowStep
        step={step}
        isDeletable={isDeletable}
        // branch steps are always nested
        isNested={true}
        isLastStep={isLastStep}
      />
      {!isOverlay && (
        <HoverAddStepButton
          isDisabled={readOnly || !canAddStep}
          isDrawerOpen={isDrawerOpen}
          isLastStep={isLastStep}
          prevStepId={step.id}
        />
      )}
    </>
  )
}

import { IStep } from '@plumber/types'

import { useContext } from 'react'

import { EditorContext } from '@/contexts/Editor'
import { FlowStep } from '@/exports/components'
import { TOOLBOX_ACTIONS, TOOLBOX_APP_KEY } from '@/helpers/toolbox'

import { HoverAddStepButton } from '../Content/IfThen/HoverAddStepButton'

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

  // cannot delete the condition step
  const isDeletable =
    step.appKey !== TOOLBOX_APP_KEY &&
    step.key !== TOOLBOX_ACTIONS.IfThen &&
    step.key !== TOOLBOX_ACTIONS.ForEach

  return (
    <>
      <FlowStep
        step={step}
        isDeletable={isDeletable}
        // branch steps are always nested
        isNested={true}
        isLastStep={isLastStep}
        allowReorder={allowReorder}
      />
      {!isOverlay && (
        <HoverAddStepButton
          isDisabled={readOnly || !canAddStep}
          isDrawerOpen={isDrawerOpen}
          isLastStep={isLastStep}
          prevStepId={step.id}
          showEmptyAction={showEmptyAction}
        />
      )}
    </>
  )
}

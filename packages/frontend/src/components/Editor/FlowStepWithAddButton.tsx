import { IStep } from '@plumber/types'

import { useContext, useMemo } from 'react'

import { EditorContext } from '@/contexts/Editor'
import { FlowStep } from '@/exports/components'
import { TOOLBOX_ACTIONS } from '@/helpers/toolbox'

import { AddStepButton } from './AddStepButton'

export default function FlowStepWithAddButton({
  step,
  isLastStep,
  isNested,
  stepsBeforeGroup,
  groupedSteps,
  showAddButton = true,
}: {
  step: IStep
  isLastStep: boolean
  isNested?: boolean
  stepsBeforeGroup: IStep[]
  groupedSteps: IStep[][]
  showAddButton?: boolean
}) {
  const { readOnly } = useContext(EditorContext)

  const nonIfThenActionSteps = stepsBeforeGroup.filter(
    (step) => step.type === 'action' && step.key !== TOOLBOX_ACTIONS.IfThen,
  )

  // Disables last add step and hide in-between add step buttons
  const hasExactlyOneEmptyActionStep =
    nonIfThenActionSteps.length === 1 && !nonIfThenActionSteps[0].appKey

  // Disables last add step button but show empty action instead
  const hasNoActionSteps = nonIfThenActionSteps.length === 0

  const getAddStepButtonProps = useMemo(() => {
    const shouldShowEmptyAction = hasNoActionSteps && !groupedSteps.length
    const shouldDisableButton =
      (hasExactlyOneEmptyActionStep || hasNoActionSteps) && !groupedSteps.length

    return (isLastStep: boolean, stepId: string) => ({
      isHidden: readOnly,
      showEmptyAction: shouldShowEmptyAction,
      isDisabled: shouldDisableButton,
      isLastStep,
      stepId,
    })
  }, [
    readOnly,
    hasNoActionSteps,
    groupedSteps.length,
    hasExactlyOneEmptyActionStep,
  ])

  return (
    <>
      <FlowStep
        step={step}
        isDeletable={true}
        isLastStep={isLastStep}
        isNested={isNested}
        // only allow reordering if there are more than 1 action steps
        allowReorder={nonIfThenActionSteps.length > 1}
      />
      {showAddButton && (
        <AddStepButton {...getAddStepButtonProps(isLastStep, step.id)} />
      )}
    </>
  )
}

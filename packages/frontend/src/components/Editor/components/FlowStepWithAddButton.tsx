import { IStep } from '@plumber/types'

import { useContext } from 'react'

import { SortableItemContext } from '@/components/SortableList/components/SortableItem'
import { MrfContext } from '@/contexts/MrfContext'
import { FlowStep } from '@/exports/components'

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
  const { disabledMrfStepToDisplay } = useContext(MrfContext)
  const { isOverlay, isSorting } = useContext(SortableItemContext)

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
      {/* Hide the add step button and dividers for the drag overlay */}
      {!isOverlay && (
        <AddStepButton
          isLastStep={isLastStep}
          step={step}
          isHidden={isHidden}
          isDisabled={isDisabled}
          showEmptyAction={showEmptyAction}
        />
      )}
      {/* Hide the disabled mrf step for the drag overlay and when sorting is taking place */}
      {shouldShowDisabledMrfStep && !isOverlay && !isSorting && (
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

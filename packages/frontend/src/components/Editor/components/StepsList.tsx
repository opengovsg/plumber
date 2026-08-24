import { Center, Flex } from '@chakra-ui/react'
import { IStep } from '@plumber/types'
import { useCallback, useContext } from 'react'

import PrimarySpinner from '@/components/PrimarySpinner'
import { SortableList } from '@/components/SortableList'
import { EditorContext } from '@/contexts/Editor'
import { MrfContext } from '@/contexts/MrfContext'
import { StepsToDisplayContext } from '@/contexts/StepsToDisplay'
import { FlowStepGroup } from '@/exports/components'
import { TOOLBOX_ACTIONS } from '@/helpers/toolbox'
import useReorderSteps from '@/hooks/useReorderSteps'

import { EDITOR_RIGHT_DRAWER_WIDTH } from '../constants'
import { editorStyles } from '../styles'
import FlowStepWithAddButton from './FlowStepWithAddButton'

interface StepsListProps {
  isNested?: boolean
}

export function StepsList({ isNested }: StepsListProps) {
  const {
    triggerStep,
    actionStepsBeforeGroup,
    groupedSteps,
    appsWithActions,
    groupingActions,
  } = useContext(StepsToDisplayContext)
  const { flow, isDrawerOpen, isMobile, readOnly } = useContext(EditorContext)
  const { mrfSteps, mrfApprovalSteps, approvalBranches } =
    useContext(MrfContext)

  const { calculateReorderedSteps, handleReorderUpdate } = useReorderSteps(
    flow.id,
  )

  const handleReorderSteps = useCallback(
    async (reorderedSteps: IStep[]) => {
      const allSteps = flow.steps
      const allReorderedSteps = calculateReorderedSteps({
        reorderedSteps,
        allSteps,
        mrfSteps,
        mrfApprovalSteps,
        approvalBranches,
      })

      try {
        await handleReorderUpdate(allReorderedSteps)
      } catch (error) {
        console.error(
          'Error updating step positions: ',
          error,
          JSON.stringify(allReorderedSteps),
        )
      }
    },
    [
      flow.steps,
      calculateReorderedSteps,
      mrfSteps,
      mrfApprovalSteps,
      approvalBranches,
      handleReorderUpdate,
    ],
  )

  const nonIfThenActionSteps = actionStepsBeforeGroup.filter(
    (step) => step.key !== TOOLBOX_ACTIONS.IfThen,
  )

  // Disables last add step and hide in-between add step buttons
  const hasExactlyOneEmptyActionStep =
    nonIfThenActionSteps.length === 1 && !nonIfThenActionSteps[0].appKey

  // Disables last add step button but show empty action instead
  const hasNoActionSteps = nonIfThenActionSteps.length === 0
  const shouldShowEmptyAction = hasNoActionSteps && !groupedSteps.length
  // for backwards compatibility where empty step is created
  const shouldDisableAddButton =
    (hasExactlyOneEmptyActionStep || hasNoActionSteps) && !groupedSteps.length

  if (!appsWithActions || !groupingActions) {
    return (
      <Center height="100vh" position="fixed" width="full" top={0} left={0}>
        <PrimarySpinner fontSize="4xl" />
      </Center>
    )
  }
  const leftStepPadding = isDrawerOpen
    ? isMobile
      ? 0
      : {
          base: '1rem',
          lg: '5rem',
        }
    : 0

  return (
    <Flex
      {...editorStyles.stepHeaderContainer}
      flex={isDrawerOpen ? (isMobile ? 0 : 1) : undefined}
      px={leftStepPadding}
      maxWidth={`calc(100% - ${
        isDrawerOpen ? EDITOR_RIGHT_DRAWER_WIDTH : '0px'
      })`}
      sx={{
        scrollbarGutter: 'stable',
      }}
    >
      {triggerStep && (
        <FlowStepWithAddButton
          step={triggerStep}
          isLastStep={
            actionStepsBeforeGroup.length === 0 && groupedSteps.length === 0
          }
          isNested={isNested}
          allowReorder={false}
          stepsBeforeGroup={[]} // no reason to pass in for this
          groupedSteps={groupedSteps}
          addButtonProps={{
            isHidden: readOnly,
            isDisabled: shouldDisableAddButton,
            showEmptyAction: shouldShowEmptyAction,
          }}
        />
      )}

      <SortableList
        items={actionStepsBeforeGroup}
        onChange={handleReorderSteps}
        renderItem={(step, isOverlay) => {
          const { id, position } = step
          return (
            <SortableList.Item id={id} isOverlay={isOverlay ?? false}>
              <Flex
                key={`${id}-${position}`}
                width={isDrawerOpen || isMobile ? '100%' : 'auto'}
                flexDir="column"
                position="relative"
              >
                <FlowStepWithAddButton
                  step={step}
                  isLastStep={
                    groupedSteps.length === 0 &&
                    actionStepsBeforeGroup[actionStepsBeforeGroup.length - 1]
                      .id === step.id
                  }
                  isNested={isNested}
                  allowReorder={nonIfThenActionSteps.length > 1}
                  stepsBeforeGroup={actionStepsBeforeGroup}
                  groupedSteps={groupedSteps}
                  addButtonProps={{
                    isHidden: readOnly || !!isOverlay,
                    isDisabled: shouldDisableAddButton,
                    showEmptyAction: shouldShowEmptyAction,
                  }}
                />
              </Flex>
            </SortableList.Item>
          )
        }}
      />
      {groupedSteps.length > 0 && (
        <FlowStepGroup
          stepsBeforeGroup={actionStepsBeforeGroup}
          groupedSteps={groupedSteps}
        />
      )}
    </Flex>
  )
}

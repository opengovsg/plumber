import { IStep } from '@plumber/types'

import { useCallback, useContext, useMemo } from 'react'
import { Center, Flex } from '@chakra-ui/react'

import PrimarySpinner from '@/components/PrimarySpinner'
import { SortableList } from '@/components/SortableList'
import { EditorContext } from '@/contexts/Editor'
import { MrfContext } from '@/contexts/MrfContext'
import { StepsToDisplayContext } from '@/contexts/StepsToDisplay'
import { FlowStepGroup } from '@/exports/components'
import useReorderSteps from '@/hooks/useReorderSteps'

import { EDITOR_RIGHT_DRAWER_WIDTH } from '../constants'
import { editorStyles } from '../styles'

import FlowStepWithAddButton from './FlowStepWithAddButton'

interface StepsListProps {
  isNested?: boolean
}

export function StepsList({ isNested }: StepsListProps) {
  const { triggerStep, regionList, appsWithActions, groupingActions } =
    useContext(StepsToDisplayContext)
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

  // Single steps across all regions (blocks contribute none). These drive the
  // whole-flow empty/disabled affordances, matching the previous behaviour where
  // they were derived from the single "before group" list.
  const allSingleSteps = useMemo(
    () =>
      regionList.flatMap((region) =>
        region.type === 'SingleSteps' ? region.steps : [],
      ),
    [regionList],
  )
  const hasBlock = regionList.some((region) => region.type === 'Block')

  // Disables last add step and hide in-between add step buttons
  const hasExactlyOneEmptyActionStep =
    allSingleSteps.length === 1 && !allSingleSteps[0].appKey

  // Disables last add step button but show empty action instead
  const hasNoActionSteps = allSingleSteps.length === 0
  const shouldShowEmptyAction = hasNoActionSteps && !hasBlock
  // for backwards compatibility where empty step is created
  const shouldDisableAddButton =
    (hasExactlyOneEmptyActionStep || hasNoActionSteps) && !hasBlock

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
          isLastStep={hasNoActionSteps && !hasBlock}
          isNested={isNested}
          allowReorder={false}
          stepsBeforeGroup={[]} // no reason to pass in for this
          groupedSteps={[]}
          addButtonProps={{
            isHidden: readOnly,
            isDisabled: shouldDisableAddButton,
            showEmptyAction: shouldShowEmptyAction,
          }}
        />
      )}

      {regionList.map((region, regionIndex) => {
        const isLastRegion = regionIndex === regionList.length - 1

        if (region.type === 'Block') {
          const previousRegion = regionList[regionIndex - 1]
          const stepsBeforeGroup =
            previousRegion?.type === 'SingleSteps' ? previousRegion.steps : []
          return (
            <FlowStepGroup
              key={`block-${region.branches[0]?.[0]?.id ?? regionIndex}`}
              stepsBeforeGroup={stepsBeforeGroup}
              groupedSteps={region.branches}
            />
          )
        }

        const regionSteps = region.steps
        const lastStepId = regionSteps[regionSteps.length - 1]?.id
        return (
          <SortableList
            key={`single-${regionIndex}`}
            items={regionSteps}
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
                      isLastStep={isLastRegion && id === lastStepId}
                      isNested={isNested}
                      allowReorder={regionSteps.length > 1}
                      stepsBeforeGroup={regionSteps}
                      groupedSteps={[]}
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
        )
      })}
    </Flex>
  )
}

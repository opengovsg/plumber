import { Center, Flex } from '@chakra-ui/react'
import { IStep } from '@plumber/types'
import { useCallback, useContext, useMemo } from 'react'

import {
  buildStepsList,
  type ForEachBlock,
  type IfThenBlock,
  type SingleStep,
} from '@/components/Editor/helpers/steps-utils'
import IfThen from '@/components/FlowStepGroup/Content/IfThen/IfThen'
import PrimarySpinner from '@/components/PrimarySpinner'
import { SortableList } from '@/components/SortableList'
import { EditorContext } from '@/contexts/Editor'
import { MrfContext } from '@/contexts/MrfContext'
import { StepsToDisplayContext } from '@/contexts/StepsToDisplay'
import { FlowStepGroup } from '@/exports/components'
import { extractBranchesWithSteps, TOOLBOX_ACTIONS } from '@/helpers/toolbox'
import { useIfThenV2Enabled } from '@/hooks/useIfThenV2Enabled'
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
    actionStepsToDisplay,
  } = useContext(StepsToDisplayContext)
  const { flow, isDrawerOpen, isMobile, readOnly } = useContext(EditorContext)
  const { mrfSteps, mrfApprovalSteps, approvalBranches } =
    useContext(MrfContext)
  const { isEnabled: isIfThenV2Enabled, isLoading: isIfThenV2Loading } =
    useIfThenV2Enabled()

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

  // The backend re-pins each block's endStepId marker after a reorder, so
  // moving it as one contiguous range needs no marker handling here.
  const handleReorderBlockItems = useCallback(
    async (
      reordered: Array<{ id: string; item: IfThenBlock | SingleStep }>,
    ) => {
      const reorderedSteps = reordered.flatMap(({ item }) =>
        item.type === 'ifThenBlock'
          ? [item.ifThenStep, ...item.children]
          : [item.step],
      )
      await handleReorderSteps(reorderedSteps)
    },
    [handleReorderSteps],
  )

  // groupingActions is null until the apps load. Guard before building the
  // list.
  const blockItems = useMemo(
    () =>
      groupingActions
        ? buildStepsList(actionStepsToDisplay, groupingActions)
        : [],
    [actionStepsToDisplay, groupingActions],
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

  if (!appsWithActions || !groupingActions || isIfThenV2Loading) {
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

  if (isIfThenV2Enabled) {
    const hasNoActionSteps = actionStepsToDisplay.length === 0
    const hasExactlyOneEmptyActionStep =
      actionStepsToDisplay.length === 1 && !actionStepsToDisplay[0].appKey
    // Same trigger add-button rules as the old layout, kept for backwards
    // compatibility.
    const shouldShowEmptyAction = hasNoActionSteps
    const shouldDisableTriggerAddButton =
      hasExactlyOneEmptyActionStep || hasNoActionSteps

    // A for-each swallows every later step, so it stays outside the
    // reorderable set and is always last.
    const forEachItem = blockItems.find(
      (item): item is ForEachBlock => item.type === 'forEachBlock',
    )
    const reorderableItems = blockItems.filter(
      (item): item is IfThenBlock | SingleStep => item.type !== 'forEachBlock',
    )
    const sortableBlockItems = reorderableItems.map((item) => ({
      id: item.type === 'ifThenBlock' ? item.ifThenStep.id : item.step.id,
      item,
    }))
    const canReorderBlocks = !readOnly && reorderableItems.length > 1
    const lastReorderableId =
      sortableBlockItems[sortableBlockItems.length - 1]?.id
    const forEachIndex = forEachItem
      ? actionStepsToDisplay.findIndex(
          (step) => step.id === forEachItem.forEachStep.id,
        )
      : -1

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
            isLastStep={hasNoActionSteps}
            isNested={isNested}
            allowReorder={false}
            stepsBeforeGroup={[]}
            groupedSteps={[]}
            addButtonProps={{
              isHidden: readOnly,
              isDisabled: shouldDisableTriggerAddButton,
              showEmptyAction: shouldShowEmptyAction,
            }}
          />
        )}

        <SortableList
          items={sortableBlockItems}
          onChange={handleReorderBlockItems}
          renderItem={(sortableItem, isOverlay) => {
            const { id, item } = sortableItem
            // A trailing for-each, not a reorderable item, claims the "last
            // step" slot when present.
            const isLast = !forEachItem && id === lastReorderableId

            if (item.type === 'ifThenBlock') {
              return (
                <SortableList.Item id={id} isOverlay={isOverlay ?? false}>
                  <IfThen
                    block={item}
                    isLastBlock={isLast}
                    allowReorder={canReorderBlocks}
                  />
                </SortableList.Item>
              )
            }

            return (
              <SortableList.Item id={id} isOverlay={isOverlay ?? false}>
                <Flex
                  width={isDrawerOpen || isMobile ? '100%' : 'auto'}
                  flexDir="column"
                  position="relative"
                >
                  <FlowStepWithAddButton
                    step={item.step}
                    isLastStep={isLast}
                    isNested={isNested}
                    allowReorder={canReorderBlocks}
                    stepsBeforeGroup={[]}
                    groupedSteps={[]}
                    addButtonProps={{
                      isHidden: readOnly || !!isOverlay,
                      isDisabled: false,
                      showEmptyAction: false,
                    }}
                  />
                </Flex>
              </SortableList.Item>
            )
          }}
        />

        {forEachItem && (
          // FlowStepGroup expects branch-shaped grouping, so the for-each's
          // steps get rebuilt into that shape instead of rendered directly.
          <FlowStepGroup
            stepsBeforeGroup={actionStepsToDisplay.slice(0, forEachIndex)}
            groupedSteps={extractBranchesWithSteps(
              actionStepsToDisplay.slice(forEachIndex),
              0,
            )}
          />
        )}
      </Flex>
    )
  }

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

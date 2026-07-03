import { IStep } from '@plumber/types'

import { Fragment, useCallback, useContext, useMemo } from 'react'
import { useMutation } from '@apollo/client'
import { Center, Flex } from '@chakra-ui/react'

import PrimarySpinner from '@/components/PrimarySpinner'
import { SortableList } from '@/components/SortableList'
import { EditorContext } from '@/contexts/Editor'
import { MrfContext } from '@/contexts/MrfContext'
import { StepsToDisplayContext } from '@/contexts/StepsToDisplay'
import { FlowStepGroup } from '@/exports/components'
import { StepEnumType } from '@/graphql/__generated__/graphql'
import { UPDATE_STEP_POSITIONS } from '@/graphql/mutations/update-step-positions'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import {
  getEarlierBranchesStepIdToJumpTo,
  getUpdatedIfThenConfigOnRegionReorder,
  isIfThenStep,
} from '@/helpers/toolbox'
import useReorderSteps from '@/hooks/useReorderSteps'

import { EDITOR_RIGHT_DRAWER_WIDTH } from '../constants'
import { editorStyles } from '../styles'

import { AddStepButton } from './AddStepButton'
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
  const [updateStepPositions] = useMutation(UPDATE_STEP_POSITIONS, {
    refetchQueries: [GET_FLOW],
  })

  const { calculateReorderedSteps, handleReorderUpdate } = useReorderSteps(
    flow.id,
  )

  const handleReorderSteps = useCallback(
    async (reorderedSteps: IStep[]) => {
      const allSteps = flow.steps
      const newStepConfigs = calculateReorderedSteps({
        reorderedSteps,
        allSteps,
        mrfSteps,
        mrfApprovalSteps,
        approvalBranches,
      })

      // If an earlier if-then is pointing to this region's first step, update
      // that if-then to the new first step after the reorder. It sits outside
      // the reordered run, so it travels as an auxiliary change rather than a
      // reposition.
      const updatedIfThenConfig = getUpdatedIfThenConfigOnRegionReorder(
        allSteps,
        reorderedSteps,
      )
      const ifThenRepoint = updatedIfThenConfig
        ? {
            stepId: updatedIfThenConfig.branchStep.id,
            stepIdToJumpTo: updatedIfThenConfig.stepIdToJumpTo,
          }
        : undefined

      try {
        await handleReorderUpdate(newStepConfigs, ifThenRepoint)
      } catch (error) {
        console.error(
          'Error updating step positions: ',
          error,
          JSON.stringify(newStepConfigs),
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
          const { branches } = region
          const isIfThenBlock = isIfThenStep(branches[0]?.[0])
          const lastBranch = branches[branches.length - 1]
          const lastBranchIfThen = lastBranch?.[0]
          const blockLastStep = lastBranch?.[lastBranch.length - 1]
          return (
            <Fragment key={`block-${branches[0]?.[0]?.id ?? regionIndex}`}>
              <FlowStepGroup
                stepsBeforeGroup={stepsBeforeGroup}
                groupedSteps={branches}
              />
              {/* Add a step immediately after the block, before any following
                  region. Rendered after every if-then block (for-each stays a
                  terminal group). Repoints the block's last branch at the new
                  step so the block ends there instead of absorbing it; the new
                  step becomes the first step of the following region (or a fresh
                  trailing region when the block is last). isLastStep reflects
                  whether the block currently ends the flow. */}
              {isIfThenBlock && lastBranchIfThen && blockLastStep && (
                <AddStepButton
                  isLastStep={isLastRegion}
                  step={blockLastStep}
                  isHidden={readOnly}
                  isDisabled={false}
                  showEmptyAction={false}
                  onAfterCreateStep={async (createdStep) => {
                    // Repoint the block's last branch at the new step (its
                    // position is unchanged; the entry just carries the new step
                    // to jump to and anchors the mutation). For a legacy block
                    // the earlier branches carry no chain yet, so send their
                    // step-to-jump-to updates as auxiliary changes (branch
                    // if-thens aren't contiguous) — this upgrades the whole block
                    // to new-style so buildRegionList reads the new step as the
                    // block's exit. No-ops for an already-chained block.
                    const earlierBranchJumpTargets =
                      getEarlierBranchesStepIdToJumpTo(branches)
                    await updateStepPositions({
                      variables: {
                        input: {
                          stepPositions: [
                            {
                              id: lastBranchIfThen.id,
                              position: lastBranchIfThen.position,
                              type: lastBranchIfThen.type as StepEnumType,
                              stepIdToJumpTo: createdStep.id,
                            },
                          ],
                          ...(earlierBranchJumpTargets.length > 0 && {
                            auxiliaryChanges: earlierBranchJumpTargets.map(
                              (jumpTarget) => ({ ifThen: jumpTarget }),
                            ),
                          }),
                          flow: { updatedAt: createdStep.flow.updatedAt },
                        },
                      },
                    })
                  }}
                />
              )}
            </Fragment>
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

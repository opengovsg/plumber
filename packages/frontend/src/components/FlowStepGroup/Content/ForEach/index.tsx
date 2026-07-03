import { IStep } from '@plumber/types'

import { Fragment, useContext, useMemo } from 'react'
import { useMutation } from '@apollo/client'
import { Flex } from '@chakra-ui/react'

import { AddStepButton } from '@/components/Editor/components/AddStepButton'
import { SortableList } from '@/components/SortableList'
import { EditorContext } from '@/contexts/Editor'
import { StepsToDisplayContext } from '@/contexts/StepsToDisplay'
import { FlowStepGroup } from '@/exports/components'
import {
  StepEnumType,
  StepPositionInput,
} from '@/graphql/__generated__/graphql'
import { UPDATE_STEP_POSITIONS } from '@/graphql/mutations/update-step-positions'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import {
  buildRegionList,
  getEarlierBranchesStepIdToJumpTo,
  getUpdatedIfThenConfigOnRegionReorder,
  isIfThenStep,
  type StepRegion,
} from '@/helpers/toolbox'
import useReorderSteps from '@/hooks/useReorderSteps'

import GroupStepWithAddButton from '../../components/GroupStepWithAddButton'

interface ForEachProps {
  groupedSteps: IStep[][]
  stepsBeforeGroup: IStep[]
}

// All steps of the regions before `regionIndex`, in flow order. Used to give a
// nested if-then block its "steps before group".
function stepsBeforeRegion(
  regions: StepRegion[],
  regionIndex: number,
): IStep[] {
  return regions
    .slice(0, regionIndex)
    .flatMap((region) =>
      region.type === 'SingleSteps' ? region.steps : region.branches.flat(),
    )
}

export default function ForEach(props: ForEachProps) {
  const { groupedSteps } = props
  const { flow, readOnly } = useContext(EditorContext)
  const { groupingActions } = useContext(StepsToDisplayContext)
  const { handleReorderUpdate } = useReorderSteps(flow.id)
  const [updateStepPositions] = useMutation(UPDATE_STEP_POSITIONS, {
    refetchQueries: [GET_FLOW],
  })

  // The block's steps in flow order: the for-each step itself, then its body.
  // The body is modelled as a region list — exactly like the top-level flow —
  // so an if-then inside the loop renders as a block that steps can follow.
  const allBlockSteps = useMemo(() => groupedSteps.flat(), [groupedSteps])
  const conditionStep = allBlockSteps[0]
  const bodyRegions = useMemo(
    () =>
      groupingActions
        ? buildRegionList(allBlockSteps.slice(1), groupingActions)
        : [],
    [allBlockSteps, groupingActions],
  )

  const hasNoActionSteps = allBlockSteps.length === 1

  const handleReorderSteps = (regionSteps: IStep[]) => async (items: any[]) => {
    // A region's steps occupy a contiguous run of positions; a reorder
    // permutes the steps within that run.
    const basePosition = regionSteps[0].position
    const stepPositions: StepPositionInput[] = items.map((item, index) => ({
      id: item.id,
      position: basePosition + index,
      type: item.step.type,
    }))

    // If the reorder changed the region's first step and a nested block's last
    // branch jumps to it (this region is that block's exit), repoint the
    // branch at the new first step. It sits outside the reordered run, so it
    // travels as an auxiliary change rather than a reposition.
    const updatedIfThenConfig = getUpdatedIfThenConfigOnRegionReorder(
      flow.steps,
      items.map((item) => item.step),
    )
    const ifThenRepoint = updatedIfThenConfig
      ? {
          stepId: updatedIfThenConfig.branchStep.id,
          stepIdToJumpTo: updatedIfThenConfig.stepIdToJumpTo,
        }
      : undefined

    try {
      handleReorderUpdate(stepPositions, ifThenRepoint)
    } catch (error) {
      console.error(
        'Error updating step positions: ',
        error,
        JSON.stringify(stepPositions),
      )
    }
  }

  const firstBodyRegionSteps =
    bodyRegions[0]?.type === 'SingleSteps' ? bodyRegions[0].steps : []

  return (
    <Flex flexDir="column" alignItems="center" borderRadius="lg" w="100%">
      <Flex flexDir="column" w="100%" px={4} py={3}>
        <GroupStepWithAddButton
          step={conditionStep}
          canAddStep={true}
          isLastStep={hasNoActionSteps}
          allowReorder={false}
          showEmptyAction={hasNoActionSteps}
          canChildStepsReorder={firstBodyRegionSteps.length > 1}
        />
        {bodyRegions.map((region, regionIndex) => {
          const isLastRegion = regionIndex === bodyRegions.length - 1

          if (region.type === 'Block') {
            const { branches } = region
            const lastBranch = branches[branches.length - 1]
            const lastBranchIfThen = lastBranch?.[0]
            const blockLastStep = lastBranch?.[lastBranch.length - 1]
            return (
              <Fragment key={`block-${branches[0]?.[0]?.id ?? regionIndex}`}>
                <FlowStepGroup
                  stepsBeforeGroup={[
                    conditionStep,
                    ...stepsBeforeRegion(bodyRegions, regionIndex),
                  ]}
                  groupedSteps={branches}
                />
                {/* Add a step immediately after the nested block, mirroring
                    the top-level after-block affordance: repoints the block's
                    last branch at the new step so the block ends there instead
                    of absorbing it. */}
                {isIfThenStep(lastBranchIfThen) && blockLastStep && (
                  <AddStepButton
                    isLastStep={isLastRegion}
                    step={blockLastStep}
                    isHidden={readOnly}
                    isDisabled={false}
                    showEmptyAction={false}
                    onAfterCreateStep={async (createdStep) => {
                      // See StepsList for the reasoning: repoint the last branch
                      // at the new step, and chain the earlier branches via
                      // auxiliary changes so a legacy (marker-less) block is
                      // upgraded to new-style rather than swallowing the new
                      // step. No-ops for an already-chained block.
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
              items={regionSteps.map((step, index) => ({
                id: step.id,
                step,
                index,
              }))}
              onChange={handleReorderSteps(regionSteps)}
              renderItem={(item, isOverlay) => {
                const { step } = item
                return (
                  <SortableList.Item id={item.id}>
                    <Flex w="100%" flexDir="column">
                      <GroupStepWithAddButton
                        step={step}
                        canAddStep={true}
                        isLastStep={isLastRegion && step.id === lastStepId}
                        isOverlay={isOverlay}
                        allowReorder={regionSteps.length > 1}
                      />
                    </Flex>
                  </SortableList.Item>
                )
              }}
            />
          )
        })}
      </Flex>
    </Flex>
  )
}

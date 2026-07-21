import { IStep } from '@plumber/types'

import { useContext } from 'react'
import { Divider, Flex } from '@chakra-ui/react'

import { MIN_FLOW_STEP_WIDTH } from '@/components/Editor/constants'
import {
  type IfThenBlock,
  isBlankPlaceholderStep,
} from '@/components/Editor/helpers/steps-utils'
import { SortableList } from '@/components/SortableList'
import { EditorContext } from '@/contexts/Editor'
import { FlowStep } from '@/exports/components'
import { StepEnumType } from '@/graphql/__generated__/graphql'
import { getFlowStepHeaderWidth } from '@/helpers/editor'
import useReorderSteps from '@/hooks/useReorderSteps'

import GroupStepWithAddButton from '../../components/GroupStepWithAddButton'
import { flowStepGroupStyles } from '../../styles'

import { HoverAddStepButton } from './HoverAddStepButton'
import { branchStyles } from './styles'

interface IfThenProps {
  block: IfThenBlock
  isLastBlock: boolean
}

interface ReorderItem {
  id: string
  step: IStep
  index: number
}

/**
 * Drawn as the same grouped box as an if-then V1 group, despite having only
 * one branch, so the two variants read as the same thing in the editor.
 *
 * IMPORTANT: block-level affordances (add-after-block, delete/duplicate) are
 * not wired here.
 */
export default function IfThen({
  block,
  isLastBlock,
}: IfThenProps): JSX.Element {
  const { ifThenStep, children } = block
  const { currentStepId, flow, isDrawerOpen, isMobile, readOnly } =
    useContext(EditorContext)
  const { handleReorderUpdate } = useReorderSteps(flow.id)

  const isEmptyBlock = children.length === 0

  // A not-yet-upgraded if-then V1 block whose only child is the branch
  // initializer's leftover blank placeholder should read as an empty V2
  // block, so the (redundant) hover-+ around that placeholder is suppressed.
  const isSoleBlankPlaceholder =
    children.length === 1 && isBlankPlaceholderStep(children[0])

  // The single-branch box merges what an if-then V1 group shows as two lines
  // (its own caption, plus the branch name inside it) into one header. A
  // user-renamed step takes priority, as it would for any step. Otherwise the
  // branch name stands in, captioned as an if-then so it doesn't read as a
  // name the user chose themselves.
  const stepName = ifThenStep.config?.stepName
  const branchName = ifThenStep.parameters?.branchName as string | undefined
  const headerLabel =
    stepName ?? (branchName ? `If-then: ${branchName}` : 'If-then')

  const handleReorderSteps = async (items: ReorderItem[]) => {
    const stepPositions = items.map((item, index) => ({
      id: item.id,
      position: ifThenStep.position + index + 1,
      type: item.step.type as StepEnumType,
    }))

    try {
      handleReorderUpdate(stepPositions)
    } catch (error) {
      console.error(
        'Error updating step positions: ',
        error,
        JSON.stringify(stepPositions),
      )
    }
  }

  return (
    <Flex flexDir="column" w="100%">
      <Flex
        w="100%"
        alignItems="center"
        justifyContent={isDrawerOpen ? 'flex-start' : 'center'}
      >
        <Flex
          {...flowStepGroupStyles.container}
          display={isMobile ? 'block' : 'flex'}
          w={getFlowStepHeaderWidth(isDrawerOpen, isMobile)}
          minW={MIN_FLOW_STEP_WIDTH}
          // The header and branch run edge to edge, so the box clips them to its
          // own rounded corners.
          overflow="hidden"
          // The box carries the selected-state border its flush header drops.
          borderColor={
            currentStepId === ifThenStep.id
              ? 'base.content.brand'
              : 'base.divider.medium'
          }
        >
          {/*
            The header stands in for the whole block, not a step of its own to
            configure. So it takes the block's name and drops click-to-configure
            and its own border, letting the box read as one step rather than a
            card holding cards.
          */}
          <FlowStep
            step={ifThenStep}
            stepNameOverride={headerLabel}
            isContainerHeader
            isClickable={false}
            isNested={true}
            isLastStep={isEmptyBlock}
            allowReorder={false}
          />

          {/*
            The condition step renders again here as a normal card, matching
            how an if-then V1 branch draws its condition card and steps in one
            panel. An empty block keeps this panel and placeholder rather than
            looking like a different component.

            The panel is white, not branchStyles.container's usual grey, since
            a single-branch box doesn't need to visually separate branches the
            way an if-then V1 group's side-by-side branches do.
          */}
          <Flex
            {...branchStyles.container}
            bg="white"
            borderRadius="none"
            // pb drops by the placeholder's own 4px bottom margin so the
            // empty-block panel stays evenly padded overall.
            pb={isEmptyBlock ? 2 : 3}
          >
            <Flex w="100%" flexDir="column">
              {/*
                This is the same condition step the header above renders, now
                as a normal, clickable card. It drops its own name and
                position number since the header already carries both.
              */}
              <FlowStep
                step={ifThenStep}
                stepNameOverride="Condition"
                hideDisplayPosition
                isNested={true}
                isLastStep={false}
                allowReorder={false}
                // Matches the width sibling cards give up for their own drag
                // handles, exactly as an if-then V1 branch's condition card
                // does, so the condition card isn't wider than the cards below
                // it.
                canChildStepsReorder={children.length > 1}
              />

              {isEmptyBlock ? (
                // The placeholder card is `w="100%"`, which only resolves to the
                // panel's width because this column stretches it; left to the
                // block box, whose items are centred, it would shrink to fit its
                // own text.
                <HoverAddStepButton
                  isDisabled={readOnly}
                  isDrawerOpen={isDrawerOpen}
                  isLastStep={true}
                  prevStep={ifThenStep}
                  showEmptyAction={true}
                  step={ifThenStep}
                  allowReorder={false}
                />
              ) : (
                <>
                  {/*
                    Every other card-to-card transition in this panel has a
                    connector; the condition card is no exception, so a
                    populated block can insert a step directly after it too.
                  */}
                  <HoverAddStepButton
                    // Reuses isDisabled for the sole-blank-placeholder edge
                    // case (see isSoleBlankPlaceholder). pointerEvents: none
                    // keeps the connector but makes the hover-+ itself inert.
                    isDisabled={readOnly || isSoleBlankPlaceholder}
                    isDrawerOpen={isDrawerOpen}
                    isLastStep={false}
                    prevStep={ifThenStep}
                    step={ifThenStep}
                    allowReorder={false}
                    canChildStepsReorder={children.length > 1}
                  />
                  <SortableList
                    items={children.map((step, index) => ({
                      id: step.id,
                      step,
                      index,
                    }))}
                    onChange={handleReorderSteps}
                    renderItem={(item, isOverlay) => {
                      const { step, index } = item
                      const isLastStep = index === children.length - 1

                      // Every step, last one included, gets the same hover +
                      // to append after it — matching how a for-each body
                      // (and an if-then V1 branch) appends, rather than the
                      // last step handing off to its own separate,
                      // always-visible "Add step" card.
                      return (
                        <SortableList.Item id={item.id}>
                          <Flex w="100%" flexDir="column">
                            <GroupStepWithAddButton
                              step={step}
                              // Same sole-blank-placeholder edge case as the
                              // leading HoverAddStepButton above: no
                              // trailing hover-+ after it either, so the
                              // card reads as an empty block's own
                              // add-first-step placeholder rather than a
                              // populated block's last member.
                              canAddStep={!isSoleBlankPlaceholder}
                              isLastStep={isLastStep}
                              isOverlay={isOverlay}
                              allowReorder={children.length > 1}
                            />
                          </Flex>
                        </SortableList.Item>
                      )
                    }}
                  />
                </>
              )}
            </Flex>
          </Flex>
        </Flex>
      </Flex>

      {/*
        Matches the height AddStepButton draws between two steps: 16+36+16px
        normally, or a 48px divider in the stronger colour once read-only
        hides the button. The block has no add-after affordance of its own
        yet, so it draws a plain line of the same height instead. The last
        block draws nothing, matching how a last step has no connector.
      */}
      {!isLastBlock && (
        <Flex flexDir="column" alignItems="center" w="100%">
          {readOnly ? (
            <Divider
              h="48px"
              orientation="vertical"
              borderColor="base.divider.strong"
            />
          ) : (
            <Divider h="68px" orientation="vertical" />
          )}
        </Flex>
      )}
    </Flex>
  )
}

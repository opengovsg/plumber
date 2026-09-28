import { Fragment } from 'react'
import { Box, Divider, Flex } from '@chakra-ui/react'

import { TOOLBOX_ACTIONS } from '@/helpers/toolbox'
import { useAiBuilderContext } from '@/pages/AiBuilder/AiBuilderContext'
import { useStepConfigContext } from '@/pages/AiBuilder/StepConfigContext'

import {
  flattenPreviewItem,
  type PreviewItem,
  type PreviewStep,
} from './helpers/previewItems'
import BranchStep from './BranchStep'
import GroupedStepContainer from './GroupedStepContainer'
import Step from './Step'

interface PreviewItemsProps {
  items: PreviewItem[]
  isNested: boolean
  effectiveActiveStepId: string | null
}

function itemKey(item: PreviewItem): string {
  switch (item.type) {
    case 'step':
      return `step-${item.step.id ?? item.step.position}`
    case 'ifThenBlock':
      return `if-${item.ifThenStep.id ?? item.ifThenStep.position}`
    case 'forEachBlock':
      return `for-each-${item.forEachStep.id ?? item.forEachStep.position}`
  }
}

/** The vertical line between two consecutive top-level or nested items. */
function Connector({ isNested }: { isNested: boolean }) {
  return (
    <Flex justifyContent="center" h={isNested ? 6 : 12}>
      <Divider orientation="vertical" borderColor="base.divider.medium" />
    </Flex>
  )
}

/**
 * Renders the action steps in editor order: plain steps, If blocks with the
 * steps they gate, and a for-each whose body holds everything after it.
 */
export default function PreviewItems({
  items,
  isNested,
  effectiveActiveStepId,
}: PreviewItemsProps) {
  const { output, isMobile } = useAiBuilderContext()
  const { stepParametersByStepId, completedStepIds } = useStepConfigContext()

  const isMcpPipeMode = Boolean(output?.pipeId)

  const pipeModeProps = (step: PreviewStep) =>
    isMcpPipeMode
      ? {
          isActive: step.id === effectiveActiveStepId,
          isConfigured: Boolean(step.id && completedStepIds.has(step.id)),
          parameters: step.id ? stepParametersByStepId[step.id] : undefined,
        }
      : {}

  // In pipe mode a block whose steps are neither active nor configured yet is
  // muted, so the user's eye follows the step being configured.
  const isBlockPending = (item: PreviewItem) =>
    isMcpPipeMode &&
    !flattenPreviewItem(item).some(
      (step) =>
        step.id === effectiveActiveStepId ||
        (step.id != null && completedStepIds.has(step.id)),
    )

  return (
    <>
      {items.map((item, index) => {
        const isLast = index === items.length - 1

        if (item.type === 'step') {
          return (
            <Step
              key={itemKey(item)}
              step={item.step}
              isNested={isNested}
              isLastStep={isLast}
              {...pipeModeProps(item.step)}
            />
          )
        }

        if (item.type === 'ifThenBlock') {
          return (
            <Fragment key={itemKey(item)}>
              <GroupedStepContainer
                stepGroupType={TOOLBOX_ACTIONS.IfThen}
                stepGroupCaption="If"
                isNested={isNested}
                isPending={isBlockPending(item)}
              >
                <Flex flexDir="column" w="100%" px={2} gap={4} mt={2}>
                  <BranchStep
                    branchSteps={[item.ifThenStep, ...item.children]}
                    isMobile={isMobile}
                    effectiveActiveStepId={effectiveActiveStepId}
                  />
                </Flex>
              </GroupedStepContainer>
              {!isLast && <Connector isNested={isNested} />}
            </Fragment>
          )
        }

        return (
          <Fragment key={itemKey(item)}>
            <GroupedStepContainer
              stepGroupType={TOOLBOX_ACTIONS.ForEach}
              stepGroupCaption="Repeat"
              isNested={isNested}
              isPending={isBlockPending(item)}
            >
              <Box w="100%">
                <Flex flexDir="column" w="100%" px={4} py={3}>
                  <Step
                    step={item.forEachStep}
                    isNested={true}
                    isLastStep={item.children.length === 0}
                    {...pipeModeProps(item.forEachStep)}
                  />
                  <PreviewItems
                    items={item.children}
                    isNested={true}
                    effectiveActiveStepId={effectiveActiveStepId}
                  />
                </Flex>
              </Box>
            </GroupedStepContainer>
            {!isLast && <Connector isNested={isNested} />}
          </Fragment>
        )
      })}
    </>
  )
}

import type { IJSONObject } from '@plumber/types'

import { useMemo, useState } from 'react'
import { BiSolidCheckCircle } from 'react-icons/bi'
import { RiArrowDownSLine, RiArrowUpSLine } from 'react-icons/ri'
import { Box, Flex, Icon, Text } from '@chakra-ui/react'

import {
  CONDITION_BLOCK_BODY_PB,
  conditionBlockStyles,
} from '@/components/FlowStepGroup/Content/IfThen/styles'
import getStepName from '@/helpers/getStepName'
import { useAiBuilderContext } from '@/pages/AiBuilder/AiBuilderContext'

import type { PreviewStep } from './helpers/previewItems'
import StepParameterRows from './StepParameterRows'

const COMPLETED_BADGE_SIZE_PX = 16
const COMPLETED_BADGE_OVERHANG_PX = COMPLETED_BADGE_SIZE_PX / 2

interface PreviewConditionBlockProps {
  badge: string
  title: string
  step: PreviewStep
  isPending?: boolean
  isCompleted?: boolean
  isActive?: boolean
  isConfigured?: boolean
  parameters?: IJSONObject
  children: React.ReactNode
}

/**
 * Read-only If or Repeat block for the chat preview. Matches the editor's
 * condition block: a badge header, then only the steps inside the block.
 *
 * The header collapses the block step's own parameters, like a plain step's
 * card does. They stay on the header so the body holds only inner steps.
 */
export default function PreviewConditionBlock({
  badge,
  title,
  step,
  isPending = false,
  isCompleted = false,
  isActive = false,
  isConfigured = false,
  parameters,
  children,
}: PreviewConditionBlockProps): JSX.Element {
  const { allApps, steps } = useAiBuilderContext()
  const [isExpanded, setIsExpanded] = useState(false)

  const stepNameById = useMemo(
    () =>
      new Map(
        steps.map((s) => [
          s.id,
          `${s.position}. ${getStepName(allApps, s).stepName}`,
        ]),
      ),
    [steps, allApps],
  )

  const canToggle = isConfigured && !isActive
  const showParams = Boolean(
    parameters && (isActive || (isConfigured && isExpanded)),
  )

  return (
    <Flex
      data-testid="block"
      data-badge={badge}
      data-title={title}
      data-pending={String(isPending)}
      data-completed={String(isCompleted)}
      data-expanded={String(showParams)}
      {...conditionBlockStyles.container}
      borderWidth="1px"
      borderColor={isActive ? 'primary.500' : 'base.divider.medium'}
      boxShadow={
        isActive ? '0 0 0 3px var(--chakra-colors-primary-100)' : undefined
      }
      opacity={isPending ? 0.55 : 1}
      pointerEvents={isPending ? 'none' : 'auto'}
    >
      <Box bg={conditionBlockStyles.header.bg}>
        <Flex
          data-testid="block-header"
          {...conditionBlockStyles.header}
          alignItems="center"
          cursor={canToggle ? 'pointer' : 'default'}
          onClick={canToggle ? () => setIsExpanded((v) => !v) : undefined}
          _hover={canToggle ? { bg: 'interaction.muted.neutral.hover' } : {}}
        >
          <Text
            flex="1"
            minW={0}
            noOfLines={2}
            textStyle="body-2"
            color="base.content.medium"
            // Room for the check, which noOfLines would otherwise cut.
            pt={`${COMPLETED_BADGE_OVERHANG_PX}px`}
            mt={`-${COMPLETED_BADGE_OVERHANG_PX}px`}
          >
            <Text
              as="span"
              position="relative"
              display="inline-flex"
              alignItems="center"
              verticalAlign="text-bottom"
              px={2}
              py="2px"
              mr={2}
              borderRadius="md"
              bg="primary.100"
              color="primary.500"
              textStyle="caption-3"
            >
              {badge}
              {isCompleted && (
                <Flex
                  as="span"
                  data-testid="block-tested"
                  position="absolute"
                  top={0}
                  insetEnd={0}
                  boxSize={`${COMPLETED_BADGE_SIZE_PX}px`}
                  transform={`translate(${COMPLETED_BADGE_OVERHANG_PX}px, -${COMPLETED_BADGE_OVERHANG_PX}px)`}
                  borderRadius="full"
                  bg="white"
                >
                  <Icon
                    boxSize="full"
                    color="interaction.success.default"
                    as={BiSolidCheckCircle}
                  />
                </Flex>
              )}
            </Text>
            {title}
          </Text>

          {canToggle && (
            <Icon
              data-testid="block-chevron"
              as={isExpanded ? RiArrowUpSLine : RiArrowDownSLine}
              boxSize={5}
              color="base.content.medium"
              flexShrink={0}
              ml={2}
            />
          )}
        </Flex>

        {showParams && parameters && (
          <StepParameterRows
            parameters={parameters}
            appKey={step.appKey ?? ''}
            stepKey={step.key ?? ''}
            stepId={step.id ?? ''}
            connectionLabel={step.connectionLabel}
            stepNameById={stepNameById}
          />
        )}
      </Box>
      <Flex {...conditionBlockStyles.body} pb={CONDITION_BLOCK_BODY_PB}>
        {children}
      </Flex>
    </Flex>
  )
}

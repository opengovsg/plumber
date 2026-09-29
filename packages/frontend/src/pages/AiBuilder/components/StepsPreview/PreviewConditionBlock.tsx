import { BiSolidCheckCircle } from 'react-icons/bi'
import { Flex, Icon, Text } from '@chakra-ui/react'

import {
  CONDITION_BLOCK_BODY_PB,
  conditionBlockStyles,
} from '@/components/FlowStepGroup/Content/IfThen/styles'

const COMPLETED_BADGE_SIZE_PX = 16
const COMPLETED_BADGE_OVERHANG_PX = COMPLETED_BADGE_SIZE_PX / 2

interface PreviewConditionBlockProps {
  badge: string
  title: string
  isPending?: boolean
  isCompleted?: boolean
  children: React.ReactNode
}

/**
 * Read-only If or Repeat block for the chat preview. Matches the editor's
 * condition block: a badge header, then only the steps inside the block.
 */
export default function PreviewConditionBlock({
  badge,
  title,
  isPending = false,
  isCompleted = false,
  children,
}: PreviewConditionBlockProps): JSX.Element {
  return (
    <Flex
      data-testid="block"
      data-badge={badge}
      data-title={title}
      data-pending={String(isPending)}
      data-completed={String(isCompleted)}
      {...conditionBlockStyles.container}
      borderWidth="1px"
      borderColor="base.divider.medium"
      opacity={isPending ? 0.55 : 1}
    >
      <Flex {...conditionBlockStyles.header} alignItems="center">
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
      </Flex>
      <Flex {...conditionBlockStyles.body} pb={CONDITION_BLOCK_BODY_PB}>
        {children}
      </Flex>
    </Flex>
  )
}

import { Flex, Text } from '@chakra-ui/react'

import {
  CONDITION_BLOCK_BODY_PB,
  conditionBlockStyles,
} from '@/components/FlowStepGroup/Content/IfThen/styles'

interface PreviewConditionBlockProps {
  badge: string
  title: string
  isPending?: boolean
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
  children,
}: PreviewConditionBlockProps): JSX.Element {
  return (
    <Flex
      data-testid="block"
      data-badge={badge}
      data-title={title}
      data-pending={String(isPending)}
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
        >
          <Text
            as="span"
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

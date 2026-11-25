import { Flex, Text } from '@chakra-ui/react'
import type { ReactNode } from 'react'

import {
  CONDITION_BLOCK_BODY_PB,
  conditionBlockStyles,
} from '@/components/FlowStepGroup/Content/IfThen/styles'
import { getFlowStepHeaderWidth } from '@/helpers/editor'

interface TemplateConditionBlockProps {
  label: string
  badge: string
  title: string
  isNested: boolean
  // Omit for a block without a body, such as CONTINUE IF.
  children?: ReactNode
}

/**
 * Read-only IF, CONTINUE IF or REPEAT block, styled like the editor's.
 */
export default function TemplateConditionBlock({
  label,
  badge,
  title,
  isNested,
  children,
}: TemplateConditionBlockProps) {
  return (
    <Flex
      role="group"
      aria-label={label}
      {...conditionBlockStyles.container}
      w={getFlowStepHeaderWidth(false, false, isNested)}
      maxW="100%"
      borderWidth="1px"
      borderColor="base.divider.medium"
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
      {children && (
        <Flex {...conditionBlockStyles.body} pb={CONDITION_BLOCK_BODY_PB}>
          {children}
        </Flex>
      )}
    </Flex>
  )
}

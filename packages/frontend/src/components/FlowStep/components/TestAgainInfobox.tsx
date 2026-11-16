import { Flex, Icon, Text } from '@chakra-ui/react'
import { useContext } from 'react'
import { BiSolidErrorCircle } from 'react-icons/bi'

import { EditorContext } from '@/contexts/Editor'
import { getFlowStepHeaderWidth } from '@/helpers/editor'

import {
  flowStepStyles,
  growBox,
  SELECTED_BORDER_GROWTH,
  SELECTED_BORDER_WIDTH,
} from '../styles'

interface TestAgainInfoboxProps {
  isNested?: boolean
  shouldHighlight: boolean
}

export default function TestAgainInfobox(props: TestAgainInfoboxProps) {
  const { isNested, shouldHighlight } = props
  const { isDrawerOpen, isMobile } = useContext(EditorContext)
  const headerWidth = getFlowStepHeaderWidth(isDrawerOpen, isMobile, isNested)

  const frame = shouldHighlight
    ? {
        borderWidth: SELECTED_BORDER_WIDTH,
        borderBottomWidth: 0,
        mx: `-${SELECTED_BORDER_GROWTH}`,
        mt: `-${SELECTED_BORDER_GROWTH}`,
        w: growBox(headerWidth),
        h: `calc(${isNested ? '2rem' : '2.5rem'} + ${SELECTED_BORDER_GROWTH})`,
      }
    : { w: headerWidth }

  return (
    <Flex
      {...flowStepStyles.incompleteContainer}
      borderColor={
        shouldHighlight ? 'base.content.brand' : 'base.divider.medium'
      }
      boxSize={isNested ? 8 : 10}
      // A selected step has a 2px border, so the banner above it matches.
      {...frame}
    >
      <Icon boxSize={6} color="yellow.200" as={BiSolidErrorCircle} />
      <Text textStyle="body-2" color="base.content.medium" p={0} ml={1.5}>
        Update this step with the latest data
      </Text>
    </Flex>
  )
}

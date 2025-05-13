import { useContext } from 'react'
import { BiSolidErrorCircle } from 'react-icons/bi'
import { Flex, Icon, Text } from '@chakra-ui/react'

import { EditorContext } from '@/contexts/Editor'
import { getFlowStepHeaderWidth } from '@/helpers/editor'

import { flowStepStyles } from '../styles'

interface TestAgainInfoboxProps {
  isNested?: boolean
  shouldHighlight: boolean
}

export default function TestAgainInfobox(props: TestAgainInfoboxProps) {
  const { isNested, shouldHighlight } = props
  const { isDrawerOpen, isMobile } = useContext(EditorContext)

  return (
    <Flex
      {...flowStepStyles.incompleteContainer}
      borderColor={
        shouldHighlight ? 'base.content.brand' : 'base.divider.medium'
      }
      boxSize={isNested ? 8 : 10}
      w={getFlowStepHeaderWidth(isDrawerOpen, isMobile, isNested)}
    >
      <Icon boxSize={6} color="yellow.200" as={BiSolidErrorCircle} />
      <Text textStyle="body-2" color="base.content.medium" p={0} ml={1.5}>
        Update this step with the latest data
      </Text>
    </Flex>
  )
}

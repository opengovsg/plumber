import { Flex } from '@chakra-ui/react'
import { useIsMobile } from '@opengovsg/design-system-react'

import { MIN_FLOW_STEP_WIDTH } from '@/components/Editor/constants'

interface FlowStepWrapperProps {
  children: React.ReactNode
  isNested?: boolean
}

export default function FlowStepWrapper(props: FlowStepWrapperProps) {
  const { children, isNested } = props
  const isMobile = useIsMobile()

  return (
    <Flex
      alignItems="center"
      display={isMobile ? 'block' : 'flex'}
      flexDir="column"
      w="100%"
      minW={isNested ? '100%' : MIN_FLOW_STEP_WIDTH}
    >
      {children}
    </Flex>
  )
}

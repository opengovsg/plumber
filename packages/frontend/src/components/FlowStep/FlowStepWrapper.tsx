import { Flex } from '@chakra-ui/react'
import { useIsMobile } from '@opengovsg/design-system-react'

interface FlowStepWrapperProps {
  children: React.ReactNode
}

export default function FlowStepWrapper(props: FlowStepWrapperProps) {
  const { children } = props
  const isMobile = useIsMobile()

  return (
    <Flex
      alignItems="center"
      display={isMobile ? 'block' : 'flex'}
      flexDir="column"
      w="100%"
    >
      {children}
    </Flex>
  )
}

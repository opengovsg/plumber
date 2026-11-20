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
      // IMPORTANT: some Flex column parents (a for-each body, an if-then
      // branch's own steps) default to alignItems="stretch" instead of
      // "center". That would leave this width-narrowed wrapper flush against
      // the left edge. alignSelf keeps it centred regardless of the parent.
      alignSelf="center"
      w="100%"
    >
      {children}
    </Flex>
  )
}

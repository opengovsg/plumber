import { Flex } from '@chakra-ui/react'
import { useIsMobile } from '@opengovsg/design-system-react'

import { NESTED_DRAG_HANDLE_WIDTH } from '../SortableList/components/SortableItem'

interface FlowStepWrapperProps {
  children: React.ReactNode
  canChildStepsReorder?: boolean
  allowReorder?: boolean
  isDrawerOpen?: boolean
  isReadOnly?: boolean
}

export default function FlowStepWrapper(props: FlowStepWrapperProps) {
  const {
    children,
    canChildStepsReorder,
    allowReorder,
    isDrawerOpen,
    isReadOnly,
  } = props
  const isMobile = useIsMobile()

  return (
    <Flex
      alignItems="center"
      display={isMobile ? 'block' : 'flex'}
      flexDir="column"
      w={
        canChildStepsReorder &&
        !allowReorder &&
        !isMobile &&
        !isDrawerOpen &&
        !isReadOnly
          ? `calc(100% - ${NESTED_DRAG_HANDLE_WIDTH}px)`
          : '100%'
      }
    >
      {children}
    </Flex>
  )
}

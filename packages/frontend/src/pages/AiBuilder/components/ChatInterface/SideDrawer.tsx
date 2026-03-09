import { Box, Flex } from '@chakra-ui/react'
import { useIsMobile } from '@opengovsg/design-system-react'

import StepsPreview from '../StepsPreview'

interface SideDrawerProps {
  isOpen: boolean
  isReadyForPreview: boolean
}

export default function SideDrawer({
  isOpen,
  isReadyForPreview,
}: SideDrawerProps) {
  const isMobile = useIsMobile()

  return (
    <Box
      position="absolute"
      right={0}
      top={0}
      w={isMobile ? '100%' : '50%'}
      h="100%"
      bg="white"
      borderLeft={isMobile ? 'none' : '1px'}
      borderColor="gray.200"
      transform={isOpen ? 'translateX(0)' : 'translateX(100%)'}
      transition="transform 0.3s ease-in-out"
      zIndex={10}
      pointerEvents={isOpen ? 'auto' : 'none'}
      visibility={isOpen ? 'visible' : 'hidden'}
    >
      <Flex h="100%" flexDir="column" w="full">
        {/* Content */}
        <Box flex={1} overflowY="auto" py={6}>
          {isOpen && <StepsPreview isReadyForPreview={isReadyForPreview} />}
        </Box>
      </Flex>
    </Box>
  )
}

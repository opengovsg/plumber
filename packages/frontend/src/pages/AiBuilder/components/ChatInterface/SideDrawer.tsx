import { Box, Flex, Text } from '@chakra-ui/react'
import { useIsMobile } from '@opengovsg/design-system-react'

import StepsPreview from '../StepsPreview'

interface SideDrawerProps {
  isOpen: boolean
}

export default function SideDrawer({ isOpen }: SideDrawerProps) {
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
      <Flex h="100%" flexDir="column" px={6} w="full">
        {/* Header */}
        <Flex justify="space-between" align="center" py={4}>
          <Text fontSize="xl" fontWeight="bold">
            Workflow preview
          </Text>
        </Flex>

        {/* Content */}
        <Box flex={1} overflowY="auto" pb={4}>
          {isOpen && <StepsPreview />}
        </Box>
      </Flex>
    </Box>
  )
}

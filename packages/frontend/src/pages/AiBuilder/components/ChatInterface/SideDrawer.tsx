import { Box, CloseButton, Flex } from '@chakra-ui/react'
import { useIsMobile } from '@opengovsg/design-system-react'

import StepsPreview from '../StepsPreview'

interface SideDrawerProps {
  isOpen: boolean
  isReadyForPreview: boolean
  onClose: () => void
}

export default function SideDrawer({
  isOpen,
  isReadyForPreview,
  onClose,
}: SideDrawerProps) {
  const isMobile = useIsMobile()

  return (
    <Box
      position="absolute"
      right={0}
      top={0}
      w={isMobile ? '100%' : '50%'}
      h="100%"
      borderLeft={isMobile ? 'none' : '1px'}
      borderColor="gray.200"
      transform={isOpen ? 'translateX(0)' : 'translateX(100%)'}
      transition="transform 0.3s ease-in-out"
      zIndex={10}
      pointerEvents={isOpen ? 'auto' : 'none'}
      visibility={isOpen ? 'visible' : 'hidden'}
      sx={{
        backgroundImage: 'radial-gradient(#f5f5f5 2px, white 2px)',
        backgroundSize: '30px 30px',
      }}
    >
      <Flex h="100%" flexDir="column" w="full" py={isMobile ? 0 : 4}>
        {isMobile && (
          <Flex
            px={4}
            borderBottom="1px solid"
            borderColor="base.divider.medium"
            py={2}
            bg="white"
          >
            <CloseButton size="sm" onClick={onClose} />
          </Flex>
        )}

        {/* Content */}
        <Box flex={1} overflowY="auto" py={2} px={isMobile ? 4 : 0}>
          {isOpen && <StepsPreview isReadyForPreview={isReadyForPreview} />}
        </Box>
      </Flex>
    </Box>
  )
}

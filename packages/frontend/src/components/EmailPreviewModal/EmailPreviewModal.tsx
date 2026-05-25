import { useMemo, useState } from 'react'
import {
  Box,
  Flex,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
} from '@chakra-ui/react'
import { transformForClient } from '@emailens/engine'

interface ClientOption {
  id: string
  label: string
  subtitle: string
}

const CLIENT_OPTIONS: ClientOption[] = [
  {
    id: 'outlook-windows-legacy',
    label: 'Outlook Classic',
    subtitle: 'Microsoft Word engine',
  },
  {
    id: 'gmail-web',
    label: 'Gmail',
    subtitle: 'Gmail Web',
  },
  {
    id: 'apple-mail-macos',
    label: 'Apple Mail',
    subtitle: 'WebKit on macOS',
  },
  {
    id: 'yahoo-mail',
    label: 'Yahoo Mail',
    subtitle: 'Yahoo webmail',
  },
]

interface EmailPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  html: string
}

export default function EmailPreviewModal({
  isOpen,
  onClose,
  html,
}: EmailPreviewModalProps) {
  const [selectedClientId, setSelectedClientId] = useState<string>(
    'outlook-windows-legacy',
  )

  const transformed = useMemo(() => {
    return transformForClient(html, selectedClientId).html
  }, [html, selectedClientId])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="6xl"
      motionPreset="none"
      isCentered
    >
      <ModalOverlay />
      <ModalContent maxH="85vh" overflow="hidden" borderRadius="lg">
        <ModalHeader
          position="sticky"
          top={0}
          bg="white"
          zIndex={1}
          borderBottom="1px solid"
          borderColor="base.divider.medium"
        >
          <Flex direction="column">Email preview</Flex>
          <ModalCloseButton />
        </ModalHeader>
        <ModalBody p={4}>
          <Flex direction="row" gap={4} h="70vh">
            <Flex
              direction="column"
              flex="0 0 220px"
              borderRight="1px solid"
              borderColor="base.divider.medium"
              pr={2}
              gap={1}
              overflowY="auto"
            >
              {CLIENT_OPTIONS.map((option) => {
                const isSelected = option.id === selectedClientId
                return (
                  <Box
                    key={option.id}
                    as="button"
                    type="button"
                    textAlign="left"
                    px={3}
                    py={2}
                    borderRadius="md"
                    bg={isSelected ? 'primary.50' : undefined}
                    _hover={{ bg: isSelected ? 'primary.50' : 'grey.100' }}
                    onClick={() => setSelectedClientId(option.id)}
                  >
                    <Text textStyle="body-1">{option.label}</Text>
                    <Text textStyle="body-2" mt={1} color="secondary.500">
                      {option.subtitle}
                    </Text>
                  </Box>
                )
              })}
            </Flex>
            <Box flex="1" minW={0}>
              <iframe
                title="Email preview"
                srcDoc={transformed}
                sandbox=""
                style={{ width: '100%', height: '100%', border: 0 }}
              />
            </Box>
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

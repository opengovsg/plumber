import { useMemo, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import {
  Box,
  Flex,
  Heading,
  Icon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
} from '@chakra-ui/react'
import { datadogRum } from '@datadog/browser-rum'
import { transformForClient } from '@emailens/engine'

import { BrokenPipeIcon } from '@/components/Icons'

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

interface PreviewPaneProps {
  html: string
  clientId: string
}

// Renders the transformed email. Extracted so the ErrorBoundary below sits
// above the transformForClient() call, which is what can actually throw.
function PreviewPane({ html, clientId }: PreviewPaneProps) {
  const transformed = useMemo(() => {
    return transformForClient(html, clientId).html
  }, [html, clientId])

  return (
    <iframe
      title="Email preview"
      srcDoc={transformed}
      sandbox=""
      style={{ width: '100%', height: '100%', border: 0 }}
    />
  )
}

function PreviewErrorFallback() {
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      h="100%"
      textAlign="center"
      px={4}
    >
      <Icon as={BrokenPipeIcon} boxSize="72px" color="primary.200" />
      <Heading as="h2" size="sm" color="base.content.strong" mt={4}>
        An error occurred
      </Heading>
      <Text textStyle="body-2" color="secondary.500" mt={2}>
        Try previewing again, or contact support if this problem persists.
      </Text>
    </Flex>
  )
}

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
              <ErrorBoundary
                fallback={<PreviewErrorFallback />}
                resetKeys={[html, selectedClientId]}
                onError={(error) => {
                  datadogRum.addError(error, {
                    feature: 'email-preview',
                    clientId: selectedClientId,
                  })
                }}
              >
                <PreviewPane html={html} clientId={selectedClientId} />
              </ErrorBoundary>
            </Box>
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

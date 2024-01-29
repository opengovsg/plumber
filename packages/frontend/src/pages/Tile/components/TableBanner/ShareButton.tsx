import { forwardRef } from 'react'
import { BiCopy, BiRefresh, BiShareAlt } from 'react-icons/bi'
import {
  Flex,
  FormControl,
  InputGroup,
  InputRightAddon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useDisclosure,
  VStack,
} from '@chakra-ui/react'
import {
  Button,
  FormHelperText,
  FormLabel,
  IconButton,
  Input,
} from '@opengovsg/design-system-react'
import copy from 'clipboard-copy'

import { useTableContext } from '../../contexts/TableContext'

const ShareModal = ({ onClose }: { onClose: () => void }) => {
  const { hasEditPermission, shareableLink } = useTableContext()

  return (
    <Modal isOpen={true} onClose={onClose} motionPreset="none">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <Text textStyle="h6">Share tile</Text>
          <ModalCloseButton />
        </ModalHeader>
        <ModalBody>
          <FormControl>
            <VStack spacing={2} alignItems="flex-start">
              <Text textStyle="subhead-3">Public Access</Text>
              <Text textStyle="body-1">
                Generate a shareable link to allow viewing and exporting only.
                No login required.
              </Text>
              <Flex alignSelf="stretch" gap={2}>
                {shareableLink && (
                  <InputGroup borderColor="primary.200">
                    <Input
                      value={shareableLink}
                      borderRightWidth={0}
                      isReadOnly
                      _focusVisible={{
                        boxShadow: 'none',
                      }}
                    />
                    <InputRightAddon
                      padding={0}
                      background="white"
                      borderColor="secondary.200"
                    >
                      <IconButton
                        icon={<BiCopy />}
                        colorScheme="secondary"
                        variant="clear"
                        isDisabled={!shareableLink}
                        aria-label={'Copy'}
                        onClick={() => copy(shareableLink ?? '')}
                      />
                    </InputRightAddon>
                  </InputGroup>
                )}
                <Button variant="outline">Generate new link</Button>
              </Flex>
              {shareableLink && (
                <FormHelperText>
                  Generating a new link will invalidate the previous link.
                </FormHelperText>
              )}
            </VStack>
          </FormControl>
        </ModalBody>
        <ModalFooter></ModalFooter>
      </ModalContent>
    </Modal>
  )
}

const ExportCsvButton = forwardRef<HTMLButtonElement>((_, ref) => {
  const { isOpen, onOpen, onClose } = useDisclosure()
  return (
    <>
      <Button
        ref={ref}
        variant="clear"
        colorScheme="secondary"
        size="xs"
        onClick={onOpen}
        leftIcon={<BiShareAlt />}
      >
        Share
      </Button>
      {/* unmount component when closed to reset all state */}
      {isOpen && <ShareModal onClose={onClose} />}
    </>
  )
})

export default ExportCsvButton

import { forwardRef, useCallback, useState } from 'react'
import { BiCopy, BiShareAlt } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
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
  IconButton,
  Input,
} from '@opengovsg/design-system-react'
import copy from 'clipboard-copy'
import * as URLS from 'config/urls'
import { CREATE_SHAREABLE_TABLE_LINK } from 'graphql/mutations/create-shareable-link'
import { GET_TABLE } from 'graphql/queries/get-table'

import { useTableContext } from '../../contexts/TableContext'

const ShareModal = ({ onClose }: { onClose: () => void }) => {
  const { tableId, viewOnlyKey } = useTableContext()
  const [isNewLink, setIsNewLink] = useState(false)

  const shareableLink = viewOnlyKey
    ? `${window.location.origin}${URLS.TILE(tableId)}/${viewOnlyKey}`
    : ''

  const [createNewLink, { loading }] = useMutation(
    CREATE_SHAREABLE_TABLE_LINK,
    {
      variables: {
        tableId,
      },
      refetchQueries: [GET_TABLE],
    },
  )

  const onGenerate = useCallback(async () => {
    await createNewLink()
    setIsNewLink(true)
  }, [createNewLink])

  const inputBorderColor = isNewLink ? 'green.400' : 'secondary.200'

  return (
    <Modal isOpen={true} onClose={onClose} motionPreset="none">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <Text textStyle="h6">Share tile</Text>
          <ModalCloseButton />
        </ModalHeader>
        <ModalBody mt={2}>
          <FormControl>
            <VStack spacing={2} alignItems="flex-start">
              <Text textStyle="subhead-3">Public Access</Text>
              <Text textStyle="body-1">
                Generate a shareable link to allow viewing and exporting only.
                No login required.
              </Text>
              <Flex alignSelf="stretch" gap={2}>
                {viewOnlyKey && (
                  <InputGroup borderWidth={0}>
                    <Input
                      value={shareableLink}
                      borderRightWidth={0}
                      borderColor={inputBorderColor}
                      _focusVisible={{ borderColor: inputBorderColor }}
                      isReadOnly
                    />
                    <InputRightAddon
                      padding={0}
                      background="white"
                      borderColor={inputBorderColor}
                    >
                      <IconButton
                        icon={<BiCopy />}
                        colorScheme="secondary"
                        variant="clear"
                        aria-label={'Copy'}
                        onClick={() => copy(shareableLink ?? '')}
                      />
                    </InputRightAddon>
                  </InputGroup>
                )}
                <Button
                  variant="outline"
                  isLoading={loading}
                  onClick={onGenerate}
                >
                  Generate new link
                </Button>
              </Flex>
              {viewOnlyKey && (
                <FormHelperText variant={isNewLink ? 'success' : undefined}>
                  {isNewLink
                    ? 'New link generated!'
                    : 'Generating a new link will invalidate the previous link.'}
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

import { useContext, useState } from 'react'
import {
  Center,
  Flex,
  FormControl,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import {
  Button,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Input,
  Spinner,
} from '@opengovsg/design-system-react'
import { EditorSettingsContext } from 'contexts/EditorSettings'

import DisallowRequestInfobox from './FlowTransfer/DisallowRequestInfobox'
import FlowTransferConnections from './FlowTransfer/FlowTransferConnections'
import PublishedFlowInfobox from './FlowTransfer/PublishedFlowInfobox'
import TransferFlowModal from './FlowTransfer/TransferFlowModal'

// TODO (mal): refactor all the spinners
export function CustomSpinner() {
  return (
    <Center>
      <Spinner color="primary.600" margin="auto" fontSize="4xl" />
    </Center>
  )
}

export default function FlowTransfer() {
  const inputDescriptionText =
    'Please enter the email account you wish to transfer'
  const { isOpen, onOpen, onClose } = useDisclosure()

  const [newOwnerEmail, setNewOwnerEmail] = useState<string>('')

  const { flow } = useContext(EditorSettingsContext)

  const requestedEmail = flow.pendingTransfer?.newOwner.email ?? ''

  // boolean values to indicate whether infoboxes and button can be enabled
  const isInputEmpty = newOwnerEmail === ''
  const hasRequestedEmail = requestedEmail !== ''
  const shouldDisableInput = flow.active || hasRequestedEmail

  return (
    <Flex
      py={{ base: '2rem', md: '3rem' }}
      px={{ base: '1.5rem', md: '5rem' }}
      flexDir="column"
      gap={10}
      maxW={{ base: '100%', xl: '60vw' }}
      flex={1}
    >
      <Text textStyle="h3-semibold">Transfer Pipe</Text>

      {flow.active && <PublishedFlowInfobox />}

      {hasRequestedEmail && <DisallowRequestInfobox />}

      {/* Connections appear if pipe is unpublished */}
      {!flow.active && <FlowTransferConnections />}

      <FormControl isInvalid={!shouldDisableInput && isInputEmpty}>
        <Flex flexDir="column" gap={1}>
          <FormLabel isRequired={true}>Transfer Pipe Ownership</FormLabel>
          <Input
            disabled={shouldDisableInput}
            placeholder={inputDescriptionText}
            value={newOwnerEmail}
            onChange={(event) => setNewOwnerEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                onOpen()
              }
            }}
          />

          {isInputEmpty ? (
            <FormErrorMessage>Email is required.</FormErrorMessage>
          ) : (
            <FormHelperText>{inputDescriptionText}</FormHelperText>
          )}

          <Button
            isDisabled={shouldDisableInput || isInputEmpty}
            onClick={onOpen}
            alignSelf="flex-end"
            mt={8}
          >
            Transfer Pipe
          </Button>

          {isOpen && (
            <TransferFlowModal
              onClose={onClose}
              newOwnerEmail={newOwnerEmail}
            />
          )}
        </Flex>
      </FormControl>
    </Flex>
  )
}

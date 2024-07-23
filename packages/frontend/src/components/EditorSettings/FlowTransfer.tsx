import { BaseSyntheticEvent, useCallback, useContext, useState } from 'react'
import { FieldValues, useForm } from 'react-hook-form'
import { Flex, FormControl, Text, useDisclosure } from '@chakra-ui/react'
import { yupResolver } from '@hookform/resolvers/yup'
import {
  Button,
  FormErrorMessage,
  FormLabel,
  Input,
} from '@opengovsg/design-system-react'
import { EditorSettingsContext } from 'contexts/EditorSettings'
import * as yup from 'yup'

import DisallowRequestInfobox from './FlowTransfer/DisallowRequestInfobox'
import FlowTransferConnections from './FlowTransfer/FlowTransferConnections'
import PublishedFlowInfobox from './FlowTransfer/PublishedFlowInfobox'
import TransferFlowModal from './FlowTransfer/TransferFlowModal'

const inputSchema = yup
  .object({
    email: yup
      .string()
      .email('Invalid email address')
      .required('Email is required'),
  })
  .required()

export default function FlowTransfer() {
  const inputDescriptionText =
    'Please enter the email account you wish to transfer'
  const { isOpen, onOpen, onClose } = useDisclosure()

  const [newOwnerEmail, setNewOwnerEmail] = useState<string>('')

  const {
    register,
    formState: { isDirty, isValid },
    handleSubmit,
  } = useForm({
    resolver: yupResolver(inputSchema),
  })
  const onSubmit = useCallback(
    (_: FieldValues, event?: BaseSyntheticEvent) => {
      if (event) {
        event.preventDefault()
        onOpen()
      }
    },
    [onOpen],
  )

  const { flow } = useContext(EditorSettingsContext)

  const requestedEmail = flow.pendingTransfer?.newOwner.email ?? ''

  // boolean values to indicate whether infoboxes and button can be enabled
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

      <form onSubmit={handleSubmit(onSubmit)}>
        <FormControl isInvalid={!shouldDisableInput && !isValid}>
          <Flex flexDir="column">
            <FormLabel isRequired={true}>Transfer Pipe Ownership</FormLabel>
            <Input
              disabled={shouldDisableInput}
              placeholder={inputDescriptionText}
              value={newOwnerEmail}
              autoFocus={true}
              {...register('email', {
                onChange: (event) => {
                  setNewOwnerEmail(event.target.value.toLowerCase())
                },
              })}
            />

            {isDirty && !isValid && (
              <FormErrorMessage>
                Please enter a valid email address.
              </FormErrorMessage>
            )}

            <Button
              type="submit"
              isDisabled={shouldDisableInput || !isValid}
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
      </form>
    </Flex>
  )
}

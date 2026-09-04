import { Flex, FormControl, Text, useDisclosure } from '@chakra-ui/react'
import { yupResolver } from '@hookform/resolvers/yup'
import {
  Button,
  FormErrorMessage,
  FormLabel,
  Input,
  TouchableTooltip,
} from '@opengovsg/design-system-react'
import { BaseSyntheticEvent, useCallback, useContext, useState } from 'react'
import { FieldValues, useForm } from 'react-hook-form'
import * as yup from 'yup'

import { EditorSettingsContext } from '@/contexts/EditorSettings'

import DisallowRequestInfobox from './FlowTransfer/DisallowRequestInfobox'
import PublishedFlowInfobox from './FlowTransfer/PublishedFlowInfobox'
import TransferFlowModal from './FlowTransfer/TransferFlowModal'
import WarningInfobox from './FlowTransfer/WarningInfobox'
import { editorSettingsStyles as styles } from './styles'

const inputSchema = yup
  .object({
    email: yup
      .string()
      .email('Invalid email address')
      .required('Email is required'),
  })
  .required()

export default function FlowTransfer() {
  const inputDescriptionText = "New owner's email address"
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
  const shouldDisableInput =
    flow.active || hasRequestedEmail || flow.role !== 'owner'

  return (
    <Flex {...styles.editorSettingsWrapper}>
      <Flex flexDir="column" gap={2}>
        <Text textStyle="h5">Transfer Pipe</Text>

        {/* Warning infobox only appears when the Pipe is unpublished and the user is the owner*/}
        {!flow.active && flow.role === 'owner' && <WarningInfobox />}
      </Flex>

      {flow.active && <PublishedFlowInfobox />}

      {hasRequestedEmail && <DisallowRequestInfobox />}

      <form onSubmit={handleSubmit(onSubmit)}>
        <FormControl isInvalid={!shouldDisableInput && !isValid}>
          <Flex flexDir="column" gap={4}>
            <FormLabel isRequired={true} mb={0}>
              Transfer to
            </FormLabel>

            <TouchableTooltip
              label={
                flow.role !== 'owner'
                  ? 'Only the Pipe owner can transfer ownership'
                  : ''
              }
            >
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
            </TouchableTooltip>

            {isDirty && !isValid && (
              <FormErrorMessage>
                Please enter a valid email address.
              </FormErrorMessage>
            )}

            <Button
              type="submit"
              isDisabled={shouldDisableInput || !isValid}
              alignSelf="flex-start"
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

import { IFlow } from '@plumber/types'

import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
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
import { GET_FLOW } from 'graphql/queries/get-flow'

import * as URLS from './../../config/urls'
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
    'Please enter a valid account on Plumber e.g. me@example.gov.sg'
  const { isOpen, onOpen, onClose } = useDisclosure()

  const { flowId } = useParams()
  const [newOwnerEmail, setNewOwnerEmail] = useState<string>('')
  const { data, loading } = useQuery(GET_FLOW, { variables: { id: flowId } })
  const flow: IFlow = data?.getFlow

  const requestedEmail = flow?.pendingTransfer?.newOwner.email ?? ''

  // boolean values to indicate whether infoboxes and button can be enabled
  const isInputEmpty = newOwnerEmail === ''
  const shouldDisableInput = flow?.active || requestedEmail !== ''

  // need to navigate user to 404 page when flow is transferred
  if (!loading && !flow) {
    return <Navigate to={URLS.FOUR_O_FOUR} />
  }

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

      {/* TODO: React suspense should fix all the loading */}
      {loading ? (
        <CustomSpinner />
      ) : (
        flow?.active && <PublishedFlowInfobox isActive={flow.active} />
      )}

      {loading ? (
        <CustomSpinner />
      ) : (
        !!requestedEmail && <DisallowRequestInfobox flow={flow} />
      )}

      {/* Connections appear if pipe is unpublished */}
      {loading ? (
        <CustomSpinner />
      ) : (
        !flow?.active && <FlowTransferConnections flow={flow} />
      )}

      <FormControl isInvalid={!shouldDisableInput && isInputEmpty}>
        <Flex flexDir="column" gap={2}>
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

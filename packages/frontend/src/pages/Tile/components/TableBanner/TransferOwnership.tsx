import { useMutation } from '@apollo/client'
import { Flex, Text, VStack } from '@chakra-ui/react'
import { Button, useToast } from '@opengovsg/design-system-react'

import { UPSERT_TABLE_COLLABORATOR } from '@/graphql/mutations/tiles/upsert-table-collaborator'
import { GET_TABLE } from '@/graphql/queries/tiles/get-table'

import { useTableContext } from '../../contexts/TableContext'

import { useShareModalContext } from './ShareModalContext'

const TransferOwnership = () => {
  const { tableId } = useTableContext()
  const { emailToTransfer, setEmailToTransfer } = useShareModalContext()

  const toast = useToast({
    status: 'success',
    duration: 3000,
    isClosable: true,
  })

  const [transferOwnership] = useMutation(UPSERT_TABLE_COLLABORATOR, {
    refetchQueries: [GET_TABLE],
    awaitRefetchQueries: false,
    variables: {
      input: {
        tableId,
        email: emailToTransfer ?? '',
        role: 'owner',
      },
    },
    onCompleted: () => {
      setEmailToTransfer(null)
      toast({
        title: `Ownership transferred`,
        description: (
          <Text>{emailToTransfer} is now the owner of this tile</Text>
        ),
      })
    },
  })

  if (!emailToTransfer) {
    return null
  }

  return (
    <VStack gap={4} alignItems="start">
      <Text textStyle="subhead-3">Ownership Transfer</Text>
      <Text>
        You are about to transfer ownership of this tile to{' '}
        <b>{emailToTransfer}</b>. Your role will changed be <b>Editor</b>.
      </Text>
      <Flex gap={4} alignSelf="end">
        <Button
          variant="clear"
          colorScheme="secondary"
          onClick={() => setEmailToTransfer(null)}
        >
          Cancel
        </Button>
        <Button variant="solid" onClick={() => transferOwnership()}>
          Confirm
        </Button>
      </Flex>
    </VStack>
  )
}

export default TransferOwnership

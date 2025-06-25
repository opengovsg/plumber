import type { IConnection } from '@plumber/types'

import * as React from 'react'
import { useCallback, useRef, useState } from 'react'
import { MdCheckCircle, MdError } from 'react-icons/md'
import { useLazyQuery, useMutation } from '@apollo/client'
import {
  Box,
  Card,
  Flex,
  Spinner,
  Stack,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import { useToast } from '@opengovsg/design-system-react'
import { DateTime } from 'luxon'

import ConnectionContextMenu from '@/components/AppConnectionContextMenu'
import MenuAlertDialog from '@/components/MenuAlertDialog'
import { DELETE_CONNECTION } from '@/graphql/mutations/delete-connection'
import { TEST_CONNECTION } from '@/graphql/queries/test-connection'

type AppConnectionRowProps = {
  connection: IConnection
}

function AppConnectionRow(props: AppConnectionRowProps): React.ReactElement {
  const toast = useToast()

  const [verificationVisible, setVerificationVisible] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [testConnection, { called: testCalled, loading: testLoading }] =
    useLazyQuery(TEST_CONNECTION, {
      fetchPolicy: 'network-only',
      onCompleted: () => {
        setTimeout(() => setVerificationVisible(false), 3000)
      },
      onError: () => {
        setTimeout(() => setVerificationVisible(false), 3000)
      },
    })
  const [deleteConnection, { loading: isDeletingConnection }] =
    useMutation(DELETE_CONNECTION)

  const { id, key, formattedData, createdAt, flowCount } = props.connection

  const cancelRef = useRef<HTMLButtonElement>(null)
  const {
    isOpen: isDialogOpen,
    onOpen: onDialogOpen,
    onClose: onDialogClose,
  } = useDisclosure()

  const onConnectionDelete = useCallback(async () => {
    await deleteConnection({
      variables: { input: { id } },
      update: (cache) => {
        const connectionCacheId = cache.identify({
          __typename: 'Connection',
          id,
        })
        cache.evict({
          id: connectionCacheId,
        })
      },
      onCompleted: () => {
        onDialogClose()
        toast({
          title: 'The connection has been deleted.',
          status: 'success',
          duration: 3000,
          isClosable: true,
          position: 'bottom-right',
        })
      },
    })
  }, [deleteConnection, id, toast, onDialogClose])

  const onContextMenuAction = useCallback(
    async (
      _event: React.MouseEvent<Element, MouseEvent>,
      action: { [key: string]: string },
    ) => {
      if (action.type === 'delete') {
        onDialogOpen()
      } else if (action.type === 'test') {
        setVerificationVisible(true)
        const testResults = await testConnection({
          variables: { connectionId: id },
        })
        if (
          testResults.data?.testConnection?.connectionVerified === false ||
          testResults.data?.testConnection?.registrationVerified === false
        ) {
          setIsVerified(false)
        } else {
          setIsVerified(true)
        }
      }
    },
    [id, onDialogOpen, testConnection],
  )

  const relativeCreatedAt = DateTime.fromMillis(
    parseInt(createdAt, 10),
  ).toRelative()

  return (
    <>
      <Card
        boxShadow="none"
        display="flex"
        flexDir="row"
        p={4}
        alignItems="center"
        justifyContent="space-between"
        borderRadius="0"
        borderBottom="1px solid"
        borderBottomColor="base.divider.medium"
      >
        <Stack
          justifyContent="center"
          alignItems="flex-start"
          flexShrink={1}
          overflowX="hidden"
          spacing={1}
          maxW="60%"
        >
          <Text textStyle={['body-2', 'body-1', 'subhead-1']} textAlign="left">
            {formattedData?.screenName?.toString() || 'Unnamed'}
          </Text>

          <Text textStyle="caption-2">added {relativeCreatedAt}</Text>
        </Stack>

        <Flex gap={[0, 1, 2]} alignItems="center">
          <Flex gap={2}>
            {verificationVisible && testCalled && testLoading && (
              <>
                <Spinner size="sm" />
                <Text textStyle="caption-2">Testing...</Text>
              </>
            )}
            {verificationVisible &&
              testCalled &&
              !testLoading &&
              isVerified && (
                <>
                  <MdCheckCircle size={16} color="green" />
                  <Text textStyle="caption-2">Test successful</Text>
                </>
              )}
            {verificationVisible &&
              testCalled &&
              !testLoading &&
              !isVerified && (
                <>
                  <MdError size={16} color="red" />
                  <Text textStyle="caption-2">Test failed</Text>
                </>
              )}
          </Flex>

          <Box px={4} flexShrink={0}>
            <Text
              textStyle="caption-1"
              display={{ base: 'none', md: 'inline-block' }}
              textAlign="center"
            >
              <Text fontSize={16}>{flowCount}</Text>
              pipes
            </Text>
          </Box>

          <Box>
            <ConnectionContextMenu
              appKey={key}
              connectionId={id}
              onMenuItemClick={onContextMenuAction}
            />
          </Box>
        </Flex>
      </Card>

      <MenuAlertDialog
        isDialogOpen={isDialogOpen}
        cancelRef={cancelRef}
        onDialogClose={onDialogClose}
        dialogHeader="Connection"
        dialogType="delete"
        onClick={onConnectionDelete}
        isLoading={isDeletingConnection}
      />
    </>
  )
}

export default AppConnectionRow

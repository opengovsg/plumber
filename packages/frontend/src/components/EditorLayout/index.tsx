import type { IFlow } from '@plumber/types'

import * as React from 'react'
import { BiChevronLeft } from 'react-icons/bi'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@apollo/client'
import { Box, HStack, Icon, Text, VStack } from '@chakra-ui/react'
import MuiButton from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import { Button, Link } from '@opengovsg/design-system-react'
import Container from 'components/Container'
import EditableTypography from 'components/EditableTypography'
import Editor from 'components/Editor'
import * as URLS from 'config/urls'
import { EditorProvider } from 'contexts/Editor'
import { UPDATE_FLOW } from 'graphql/mutations/update-flow'
import { UPDATE_FLOW_STATUS } from 'graphql/mutations/update-flow-status'
import { GET_FLOW } from 'graphql/queries/get-flow'
import useFormatMessage from 'hooks/useFormatMessage'

export default function EditorLayout(): React.ReactElement {
  const { flowId } = useParams()
  const formatMessage = useFormatMessage()
  const [updateFlow] = useMutation(UPDATE_FLOW)
  const [updateFlowStatus] = useMutation(UPDATE_FLOW_STATUS)
  const { data, loading } = useQuery(GET_FLOW, { variables: { id: flowId } })
  const flow: IFlow = data?.getFlow

  const onFlowNameUpdate = React.useCallback(
    async (name: string) => {
      await updateFlow({
        variables: {
          input: {
            id: flowId,
            name,
          },
        },
        optimisticResponse: {
          updateFlow: {
            __typename: 'Flow',
            id: flow?.id,
            name,
          },
        },
      })
    },
    [flow?.id],
  )

  const onFlowStatusUpdate = React.useCallback(
    async (active: boolean) => {
      await updateFlowStatus({
        variables: {
          input: {
            id: flowId,
            active,
          },
        },
        optimisticResponse: {
          updateFlowStatus: {
            __typename: 'Flow',
            id: flow?.id,
            active,
          },
        },
      })
    },
    [flow?.id],
  )

  return (
    <>
      <VStack h="100%">
        <HStack
          bg="white"
          w="100%"
          justifyContent="space-between"
          alignItems="center"
          py={2}
          px={2}
          borderBottom="1px solid"
          borderColor="base.divider.subtle"
        >
          <Box display="flex" flex={1} alignItems="center">
            <Link href={URLS.FLOWS}>
              <Icon
                boxSize={6}
                color="interaction.support.disabled-content"
                as={BiChevronLeft}
              ></Icon>
            </Link>

            {!loading && (
              <EditableTypography
                variant="body1"
                onConfirm={onFlowNameUpdate}
                noWrap
                sx={{ display: 'flex', flex: 1, maxWidth: '50vw', ml: 1 }}
              >
                {flow?.name}
              </EditableTypography>
            )}
          </Box>

          <Button
            as={Link}
            href={URLS.GUIDE_LINK}
            colorScheme="secondary"
            target="_blank"
            variant="link"
            pr={4}
            _hover={{ textDecoration: 'underline' }}
          >
            Guide
          </Button>

          <Box pr={1}>
            <Button size="md" onClick={() => onFlowStatusUpdate(!flow.active)}>
              <Text textStyle="subhead-1">
                {flow?.active ? 'Unpublish' : 'Publish'}
              </Text>
            </Button>
          </Box>
        </HStack>

        <Container maxW={852} p={0}>
          <EditorProvider value={{ readOnly: !!flow?.active }}>
            {!flow && !loading && 'not found'}

            {flow && <Editor flow={flow} />}
          </EditorProvider>
        </Container>
      </VStack>

      <Snackbar
        data-test="flow-cannot-edit-info-snackbar"
        open={!!flow?.active}
        message={formatMessage('flowEditor.publishedFlowCannotBeUpdated')}
        anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
        ContentProps={{ sx: { fontWeight: 300 } }}
        action={
          <MuiButton
            variant="contained"
            size="small"
            onClick={() => onFlowStatusUpdate(!flow.active)}
            data-test="unpublish-flow-from-snackbar"
          >
            {formatMessage('flowEditor.unpublish')}
          </MuiButton>
        }
      />
    </>
  )
}

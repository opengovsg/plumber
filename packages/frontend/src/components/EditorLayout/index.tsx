import type { IFlow } from '@plumber/types'

import * as React from 'react'
import { BiChevronLeft, BiCog } from 'react-icons/bi'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@apollo/client'
import { Box, HStack, Icon, Text, VStack } from '@chakra-ui/react'
import {
  Button,
  IconButton,
  TouchableTooltip,
} from '@opengovsg/design-system-react'
import Container from 'components/Container'
import EditableTypography from 'components/EditableTypography'
import Editor from 'components/Editor'
import * as URLS from 'config/urls'
import { EditorProvider } from 'contexts/Editor'
import { UPDATE_FLOW } from 'graphql/mutations/update-flow'
import { UPDATE_FLOW_STATUS } from 'graphql/mutations/update-flow-status'
import { GET_FLOW } from 'graphql/queries/get-flow'

import EditorSnackbar from './EditorSnackbar'

export default function EditorLayout(): React.ReactElement {
  const { flowId } = useParams()
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
    [flow?.id, flowId, updateFlow],
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
    [flow?.id, flowId, updateFlowStatus],
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
          px={8}
          borderBottom="1px solid"
          borderColor="base.divider.subtle"
          spacing={4}
        >
          <Box display="flex" flex={1} alignItems="center">
            <Box as={Link} to={URLS.FLOWS} mt={1}>
              <Icon
                boxSize={6}
                color="interaction.support.disabled-content"
                as={BiChevronLeft}
              ></Icon>
            </Box>

            {!loading && (
              <EditableTypography
                variant="body1"
                onConfirm={onFlowNameUpdate}
                noWrap
                sx={{ display: 'flex', flex: 1, maxWidth: '30vw', ml: 1 }}
              >
                {flow?.name}
              </EditableTypography>
            )}
          </Box>

          <Button
            as={Link}
            to={URLS.GUIDE_LINK}
            colorScheme="secondary"
            target="_blank"
            variant="link"
            _hover={{ textDecoration: 'underline' }}
          >
            Guide
          </Button>

          <TouchableTooltip label="Settings" aria-label="settings tooltip">
            <IconButton
              as={Link}
              to={URLS.FLOW_EDITOR_NOTIFICATIONS(flowId)}
              variant="outline"
              aria-label="settings"
              icon={<BiCog />}
            ></IconButton>
          </TouchableTooltip>

          <Button size="md" onClick={() => onFlowStatusUpdate(!flow.active)}>
            <Text textStyle="subhead-1">
              {flow?.active ? 'Unpublish' : 'Publish'}
            </Text>
          </Button>
        </HStack>

        <Container maxW={852} p={0}>
          <EditorProvider value={{ readOnly: !!flow?.active }}>
            {!flow && !loading && 'not found'}

            {flow && <Editor flow={flow} steps={flow.steps} />}
          </EditorProvider>
        </Container>
      </VStack>

      <EditorSnackbar
        isOpen={!!flow?.active}
        handleUnpublish={() => onFlowStatusUpdate(!flow.active)}
      ></EditorSnackbar>
    </>
  )
}

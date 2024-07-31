import type { IFlow } from '@plumber/types'

import { ReactElement, useCallback, useMemo } from 'react'
import { BiChevronLeft, BiCog } from 'react-icons/bi'
import { Link, useParams } from 'react-router-dom'
import { ApolloError, useMutation, useQuery } from '@apollo/client'
import {
  Box,
  Flex,
  HStack,
  Icon,
  Skeleton,
  Text,
  VStack,
} from '@chakra-ui/react'
import {
  Button,
  IconButton,
  Spinner,
  TouchableTooltip,
} from '@opengovsg/design-system-react'

import Container from '@/components/Container'
import EditableTypography from '@/components/EditableTypography'
import Editor from '@/components/Editor'
import DemoFlowModal from '@/components/FlowRow/DemoFlowModal'
import * as URLS from '@/config/urls'
import { EditorProvider } from '@/contexts/Editor'
import { UPDATE_FLOW } from '@/graphql/mutations/update-flow'
import { UPDATE_FLOW_CONFIG } from '@/graphql/mutations/update-flow-config'
import { UPDATE_FLOW_STATUS } from '@/graphql/mutations/update-flow-status'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import InvalidEditorPage from '@/pages/Editor/components/InvalidEditorPage'

import EditorSnackbar from './EditorSnackbar'

export default function EditorLayout(): ReactElement {
  const { flowId } = useParams()
  const [updateFlow] = useMutation(UPDATE_FLOW)
  const [updateFlowStatus] = useMutation(UPDATE_FLOW_STATUS)
  const { data, loading, error } = useQuery(GET_FLOW, {
    variables: { id: flowId },
  })
  const flow: IFlow = data?.getFlow

  // for loading demo modal
  const {
    hasLoadedOnce = true,
    isAutoCreated,
    videoId: demoVideoId,
  } = flow?.config?.demoConfig || {}

  const [updateFlowConfig] = useMutation(UPDATE_FLOW_CONFIG, {
    variables: {
      input: {
        id: flowId,
        hasLoadedOnce: true, // this is to not load demo modal and show tooltip anymore
      },
    },
    refetchQueries: [GET_FLOW],
  })

  const handleClose = useCallback(async () => {
    await updateFlowConfig()
  }, [updateFlowConfig])

  // phase 1: add check to prevent user from publishing pipe after submitting request
  const requestedEmail = flow?.pendingTransfer?.newOwner.email ?? ''
  const hasFlowTransfer = requestedEmail !== ''

  const onFlowNameUpdate = useCallback(
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

  const onFlowStatusUpdate = useCallback(
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

  // disallow user from publishing pipe if any step is incomplete
  const isFlowIncomplete = useMemo(
    () => flow?.steps.some((step) => step.status === 'incomplete'),
    [flow?.steps],
  )

  // navigate user to not found page if flow does not belong to the user
  if (
    error instanceof ApolloError &&
    error?.graphQLErrors?.find((e) => e.message === 'NotFoundError')
  ) {
    return <InvalidEditorPage />
  }

  const isEditorReadOnly = hasFlowTransfer || flow?.active

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
          <Flex flex={1} alignItems="center">
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
          </Flex>

          <Button
            as={Link}
            to={URLS.GUIDE_LINK}
            colorScheme="secondary"
            target="_blank"
            variant="link"
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

          {/* Used a tooltip instead because the words take up too much space on mobile view */}
          <TouchableTooltip
            label={
              isFlowIncomplete
                ? 'Set up for all steps must be completed before you can publish your pipe'
                : hasFlowTransfer
                ? 'You cannot publish a pipe with a pending transfer'
                : ''
            }
          >
            <Button
              isDisabled={isFlowIncomplete || hasFlowTransfer}
              isLoading={loading}
              spinner={<Spinner fontSize={24} />}
              size="md"
              onClick={() => onFlowStatusUpdate(!flow.active)}
            >
              <Skeleton isLoaded={!loading}>
                <Text textStyle="subhead-1">
                  {flow?.active ? 'Unpublish' : 'Publish'}
                </Text>
              </Skeleton>
            </Button>
          </TouchableTooltip>
        </HStack>

        <Container maxW={852} p={0}>
          <EditorProvider value={{ readOnly: isEditorReadOnly }}>
            {!flow && !loading && 'not found'}

            {flow && <Editor flow={flow} steps={flow.steps} />}
          </EditorProvider>
        </Container>
      </VStack>

      <EditorSnackbar
        isOpen={!!flow?.active}
        handleUnpublish={() => onFlowStatusUpdate(!flow.active)}
      ></EditorSnackbar>

      {!hasLoadedOnce && (
        <DemoFlowModal
          onClose={handleClose}
          isAutoCreated={isAutoCreated}
          demoVideoId={demoVideoId}
        />
      )}
    </>
  )
}

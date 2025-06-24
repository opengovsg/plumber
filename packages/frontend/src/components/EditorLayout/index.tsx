import type { IFlow } from '@plumber/types'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BiChevronLeft, BiCog, BiInfoCircle } from 'react-icons/bi'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApolloError, useMutation, useQuery } from '@apollo/client'
import {
  Box,
  Flex,
  HStack,
  Icon,
  Skeleton,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import {
  Button,
  IconButton,
  Spinner,
  TouchableTooltip,
  useIsMobile,
} from '@opengovsg/design-system-react'

import Container from '@/components/Container'
import EditableInput from '@/components/EditableInput'
import Editor from '@/components/Editor'
import DemoFlowModal from '@/components/FlowRow/DemoFlowModal'
import * as URLS from '@/config/urls'
import { EditorProvider } from '@/contexts/Editor'
import { UPDATE_FLOW } from '@/graphql/mutations/update-flow'
import { UPDATE_FLOW_STATUS } from '@/graphql/mutations/update-flow-status'
import { GET_FLOW } from '@/graphql/queries/get-flow'
import InvalidEditorPage from '@/pages/Editor/components/InvalidEditorPage'

import { EDITOR_MARGIN_TOP } from '../Editor/constants'
import UnsavedChangesAlert from '../Editor/UnsavedChangesAlert'

import AnnouncementModal, {
  LATEST_ANNOUNCEMENT_MODAL_TIMESTAMP,
  LOCAL_STORAGE_ANNOUNCEMENT_LAST_OPENED_KEY,
} from './AnnouncementModal'
import EditorSnackbar from './EditorSnackbar'
import { LensSurvey } from './LensSurvey'

export default function EditorLayout() {
  const cancelRef = useRef(null)
  const { flowId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [updateFlow] = useMutation(UPDATE_FLOW)
  const [updateFlowStatus] = useMutation(UPDATE_FLOW_STATUS, {
    refetchQueries: [GET_FLOW],
  })
  const [shouldWarnOnLeave, setShouldWarnOnLeave] = useState(false)
  const [leaveToUrl, setLeaveToUrl] = useState(URLS.FLOWS)
  const {
    isOpen: isWarningOpen,
    onOpen: onWarningOpen,
    onClose: onWarningClose,
  } = useDisclosure()

  const { data, loading, error } = useQuery(GET_FLOW, {
    variables: { id: flowId },
  })
  const flow: IFlow = data?.getFlow

  const handleClose = useCallback(() => {
    searchParams.delete('showDemo')
    setSearchParams(searchParams, { replace: true })
  }, [searchParams, setSearchParams])

  // for loading announcement modal
  const [localLatestTimestamp, setLocalLatestTimestamp] = useState(
    localStorage.getItem(LOCAL_STORAGE_ANNOUNCEMENT_LAST_OPENED_KEY),
  )

  const handleCloseAnnouncementModal = useCallback(() => {
    localStorage.setItem(
      LOCAL_STORAGE_ANNOUNCEMENT_LAST_OPENED_KEY,
      LATEST_ANNOUNCEMENT_MODAL_TIMESTAMP,
    )
    setLocalLatestTimestamp(LATEST_ANNOUNCEMENT_MODAL_TIMESTAMP)
  }, [])

  const shouldOpenAnnouncementModal =
    localLatestTimestamp !== LATEST_ANNOUNCEMENT_MODAL_TIMESTAMP

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

  const handleWarnOnLeave = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
      if (shouldWarnOnLeave) {
        e.preventDefault()
        onWarningOpen()
      }
    },
    [shouldWarnOnLeave, onWarningOpen],
  )

  // disallow user from publishing pipe if any step is incomplete
  const isFlowIncomplete = useMemo(
    () =>
      flow?.steps.length < 2 ||
      flow?.steps.some((step) => step.status === 'incomplete'),
    [flow?.steps],
  )

  // warn user of unsaved changes when they try to close or reload the browser
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!shouldWarnOnLeave) {
        return
      }
      e.preventDefault()
      e.returnValue = '' // legacy but still required by some browsers
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [shouldWarnOnLeave])

  // navigate user to not found page if flow does not belong to the user
  if (
    error instanceof ApolloError &&
    error?.graphQLErrors?.find((e) => e.message === 'NotFoundError')
  ) {
    return <InvalidEditorPage />
  }

  const isEditorReadOnly = hasFlowTransfer || flow?.active

  if (!flowId || !flow) {
    return null
  }

  // for loading demo video
  const showDemo = searchParams.get('showDemo')
  const demoVideoDetails = flow.template?.demoVideoDetails
  const shouldOpenDemoModal = showDemo === 'true' && !!demoVideoDetails

  return (
    <>
      <Flex h="100vh" flexDirection="column">
        <HStack
          position="fixed"
          top={0}
          left={0}
          right={0}
          zIndex={10}
          bg="white"
          justifyContent="space-between"
          alignItems="center"
          py={2}
          px={8}
          borderBottom="1px solid"
          borderColor="base.divider.medium"
        >
          <Flex flex={1} alignItems="center">
            <Box
              as={Link}
              to={URLS.FLOWS}
              mt={1}
              mr={3}
              onClick={handleWarnOnLeave}
            >
              <Icon
                boxSize={6}
                color="interaction.support.disabled-content"
                as={BiChevronLeft}
              ></Icon>
            </Box>

            <Flex>
              <EditableInput
                value={flow?.name}
                onSave={onFlowNameUpdate}
                readOnly={loading}
                width="auto"
              />
            </Flex>
          </Flex>

          {!isMobile && (
            <TouchableTooltip label="Guide" aria-label="guide tooltip">
              <IconButton
                as={Link}
                to={URLS.GUIDE_LINK}
                target="_blank"
                variant="clear"
                aria-label="guide"
                icon={<BiInfoCircle />}
                colorScheme="secondary"
                _hover={{
                  color: 'primary.500',
                  bg: 'interaction.muted.main.hover',
                }}
              />
            </TouchableTooltip>
          )}

          <TouchableTooltip label="Settings" aria-label="settings tooltip">
            <IconButton
              as={Link}
              to={URLS.FLOW_EDITOR_NOTIFICATIONS(flowId)}
              variant="clear"
              aria-label="settings"
              icon={<BiCog />}
              colorScheme="secondary"
              _hover={{
                color: 'primary.500',
                bg: 'interaction.muted.main.hover',
              }}
              onClick={(e) => {
                setLeaveToUrl(URLS.FLOW_EDITOR_NOTIFICATIONS(flowId))
                handleWarnOnLeave(e)
              }}
            />
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
              size="sm"
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

        <Container
          maxW="full"
          p={0}
          mt={EDITOR_MARGIN_TOP}
          flex={1}
          overflowY="auto"
        >
          <EditorProvider
            readOnly={isEditorReadOnly}
            flow={flow}
            shouldWarnOnLeave={shouldWarnOnLeave}
            setShouldWarnOnLeave={setShouldWarnOnLeave}
          >
            <Editor />
            {flow.active && flow.config?.showSurvey && <LensSurvey />}
          </EditorProvider>
        </Container>
      </Flex>

      <EditorSnackbar
        isOpen={!!flow?.active}
        handleUnpublish={() => onFlowStatusUpdate(!flow.active)}
      ></EditorSnackbar>

      {shouldOpenAnnouncementModal && (
        <AnnouncementModal
          isOpen={shouldOpenAnnouncementModal}
          onClose={handleCloseAnnouncementModal}
        />
      )}

      {shouldOpenDemoModal && (
        <DemoFlowModal
          onClose={handleClose}
          demoVideoDetails={demoVideoDetails}
        />
      )}

      <UnsavedChangesAlert
        cancelRef={cancelRef}
        isOpen={isWarningOpen}
        onClose={onWarningClose}
        onLeave={() => navigate(leaveToUrl)}
      />
    </>
  )
}

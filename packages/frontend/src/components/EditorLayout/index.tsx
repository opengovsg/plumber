import type { IFlow } from '@plumber/types'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Helmet } from 'react-helmet'
import { BiChevronLeft } from 'react-icons/bi'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApolloError, useMutation, useQuery } from '@apollo/client'
import { Box, Flex, HStack, Icon, useDisclosure } from '@chakra-ui/react'

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

import UnsavedChangesAlert from '../Editor/components/UnsavedChangesAlert'
import { EDITOR_MARGIN_TOP } from '../Editor/constants'

import AnnouncementModal, {
  LATEST_ANNOUNCEMENT_MODAL_TIMESTAMP,
  LOCAL_STORAGE_ANNOUNCEMENT_LAST_OPENED_KEY,
} from './AnnouncementModal'
import EditorSnackbar from './EditorSnackbar'
import EditorToolbar from './EditorToolbar'
import { LensSurvey } from './LensSurvey'

export default function EditorLayout() {
  const cancelRef = useRef(null)
  const resetFormRef = useRef<(() => void) | null>(null)
  const { flowId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [updateFlow] = useMutation(UPDATE_FLOW, {
    refetchQueries: [GET_FLOW], // need to refetch flow to get the latest updatedAt
  })
  const [updateFlowStatus] = useMutation(UPDATE_FLOW_STATUS, {
    refetchQueries: [GET_FLOW],
  })
  const [shouldWarnOnPublish, setShouldWarnOnPublish] = useState(false)
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

  const onFlowNameUpdate = useCallback(
    async (name: string) => {
      await updateFlow({
        variables: {
          input: {
            id: flowId,
            name,
            updatedAt: flow?.updatedAt,
          },
        },
      })
    },
    [flow?.updatedAt, flowId, updateFlow],
  )

  const onFlowStatusUpdate = useCallback(
    async (active: boolean) => {
      await updateFlowStatus({
        variables: {
          input: {
            id: flowId,
            active,
            updatedAt: flow?.updatedAt,
          },
        },
      })
    },
    [flow?.updatedAt, flowId, updateFlowStatus],
  )

  const handleWarningClose = useCallback(() => {
    setShouldWarnOnPublish(false)
    onWarningClose()
  }, [onWarningClose])

  const handleWarnOnLeave = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
      if (shouldWarnOnLeave) {
        e.preventDefault()
        onWarningOpen()
      }
    },
    [shouldWarnOnLeave, onWarningOpen],
  )

  const onDiscardChanges = useCallback(() => {
    if (shouldWarnOnPublish) {
      onFlowStatusUpdate(!flow?.active)
      resetFormRef.current?.()
    } else {
      navigate(leaveToUrl)
    }
  }, [
    onFlowStatusUpdate,
    flow?.active,
    leaveToUrl,
    navigate,
    shouldWarnOnPublish,
  ])

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
    error?.graphQLErrors?.find(
      (e) =>
        e.message === 'NotFoundError' ||
        e.message === 'You do not have sufficient permissions for this pipe',
    )
  ) {
    return <InvalidEditorPage />
  }

  if (!flowId || !flow) {
    return null
  }

  // for loading demo video
  const showDemo = searchParams.get('showDemo')
  const demoVideoDetails = flow.template?.demoVideoDetails
  const shouldOpenDemoModal = showDemo === 'true' && !!demoVideoDetails

  return (
    <EditorProvider
      flow={flow}
      shouldWarnOnLeave={shouldWarnOnLeave}
      setShouldWarnOnLeave={setShouldWarnOnLeave}
      resetFormRef={resetFormRef}
    >
      <Helmet>
        <title>{flow?.name} | Pipe</title>
      </Helmet>
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
          px={{ base: 4, md: 8 }}
          borderBottom="1px solid"
          borderColor="base.divider.medium"
        >
          <Flex flex={1} alignItems="center" minWidth={0}>
            <Box
              as={Link}
              to={URLS.FLOWS}
              mt={1}
              mr={3}
              flexShrink={0}
              onClick={handleWarnOnLeave}
            >
              <Icon
                boxSize={6}
                color="interaction.support.disabled-content"
                as={BiChevronLeft}
              ></Icon>
            </Box>

            <Flex flex={1} minWidth={0}>
              <EditableInput
                value={flow?.name}
                onSave={onFlowNameUpdate}
                readOnly={loading || flow?.role === 'viewer'}
              />
            </Flex>
          </Flex>
          <EditorToolbar
            loading={loading}
            shouldWarnOnLeave={shouldWarnOnLeave}
            setShouldWarnOnPublish={setShouldWarnOnPublish}
            onFlowStatusUpdate={onFlowStatusUpdate}
            setLeaveToUrl={setLeaveToUrl}
            handleWarnOnLeave={handleWarnOnLeave}
          />
        </HStack>

        <Container
          maxW="full"
          p={0}
          mt={EDITOR_MARGIN_TOP}
          flex={1}
          overflowY="auto"
        >
          <Editor />
          {flow?.active &&
            flow?.config?.showSurvey &&
            flow?.role !== 'viewer' && <LensSurvey />}
        </Container>
      </Flex>

      <EditorSnackbar
        isOpen={!!flow?.active}
        handleUnpublish={() => onFlowStatusUpdate(!flow.active)}
      />

      {/* hardcoded to false to always hide announcement modal for now*/}
      {shouldOpenAnnouncementModal && false && (
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
        onClose={handleWarningClose}
        onLeave={onDiscardChanges}
      />
    </EditorProvider>
  )
}

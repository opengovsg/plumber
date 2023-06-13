import type { IFlow } from '@plumber/types'

import * as React from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@apollo/client'
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew'
import Box from '@mui/material/Box'
import MuiButton from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Container from 'components/Container'
import EditableTypography from 'components/EditableTypography'
import Editor from 'components/Editor'
import { GuideFab } from 'components/GuideFab'
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
      <Stack direction="column" height="100%">
        <Stack
          direction="row"
          bgcolor="white"
          justifyContent="space-between"
          alignItems="center"
          py={1}
          px={1}
          borderBottom="1px solid"
          borderColor="divider"
        >
          <Box display="flex" flex={1} alignItems="center">
            <Tooltip
              placement="right"
              title={formatMessage('flowEditor.goBack')}
              disableInteractive
            >
              <IconButton
                size="small"
                component={RouterLink}
                to={URLS.FLOWS}
                data-test="editor-go-back-button"
              >
                <ArrowBackIosNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {!loading && (
              <EditableTypography
                variant="body1"
                onConfirm={onFlowNameUpdate}
                noWrap
                sx={{ display: 'flex', flex: 1, maxWidth: '50vw', ml: 2 }}
              >
                {flow?.name}
              </EditableTypography>
            )}
          </Box>

          <Box pr={1}>
            <MuiButton
              variant="contained"
              size="small"
              onClick={() => onFlowStatusUpdate(!flow.active)}
              data-test={
                flow?.active ? 'unpublish-flow-button' : 'publish-flow-button'
              }
            >
              {flow?.active
                ? formatMessage('flowEditor.unpublish')
                : formatMessage('flowEditor.publish')}
            </MuiButton>
          </Box>
        </Stack>

        <Container maxWidth="md">
          <EditorProvider value={{ readOnly: !!flow?.active }}>
            {!flow && !loading && 'not found'}

            {flow && <Editor flow={flow} />}
          </EditorProvider>
        </Container>
      </Stack>

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
      <GuideFab />
    </>
  )
}

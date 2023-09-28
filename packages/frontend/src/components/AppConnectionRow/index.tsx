import type { IConnection } from '@plumber/types'

import * as React from 'react'
import { useLazyQuery, useMutation } from '@apollo/client'
import { Card } from '@chakra-ui/react'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import Box from '@mui/material/Box'
import CardActionArea from '@mui/material/CardActionArea'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import ConnectionContextMenu from 'components/AppConnectionContextMenu'
import { DELETE_CONNECTION } from 'graphql/mutations/delete-connection'
import { TEST_CONNECTION } from 'graphql/queries/test-connection'
import useFormatMessage from 'hooks/useFormatMessage'
import { DateTime } from 'luxon'
import { useSnackbar } from 'notistack'

import { CardContent, Typography } from './style'

type AppConnectionRowProps = {
  connection: IConnection
}

const countTranslation = (value: React.ReactNode) => (
  <>
    <Typography variant="body1">{value}</Typography>
    <br />
  </>
)

function AppConnectionRow(props: AppConnectionRowProps): React.ReactElement {
  const { enqueueSnackbar } = useSnackbar()
  const [verificationVisible, setVerificationVisible] = React.useState(false)
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
  const [deleteConnection] = useMutation(DELETE_CONNECTION)

  const formatMessage = useFormatMessage()
  const { id, key, formattedData, verified, createdAt, flowCount } =
    props.connection

  const contextButtonRef = React.useRef<SVGSVGElement | null>(null)
  const [anchorEl, setAnchorEl] = React.useState<SVGSVGElement | null>(null)

  const handleClose = () => {
    setAnchorEl(null)
  }

  const onContextMenuClick = () => setAnchorEl(contextButtonRef.current)
  const onContextMenuAction = React.useCallback(
    async (
      _event: React.MouseEvent<Element, MouseEvent>,
      action: { [key: string]: string },
    ) => {
      if (action.type === 'delete') {
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
        })

        enqueueSnackbar(formatMessage('connection.deletedMessage'), {
          variant: 'success',
        })
      } else if (action.type === 'test') {
        setVerificationVisible(true)
        testConnection({ variables: { connectionId: id } })
      }
    },
    [deleteConnection, id, testConnection, formatMessage, enqueueSnackbar],
  )

  const relativeCreatedAt = DateTime.fromMillis(
    parseInt(createdAt, 10),
  ).toRelative()

  return (
    <>
      <Card
        boxShadow="none"
        _hover={{ bg: 'interaction.muted.neutral.hover' }}
        _active={{ bg: 'interaction.muted.neutral.active' }}
        borderRadius="0"
        borderBottom="1px solid"
        borderBottomColor="base.divider.medium"
      >
        <CardActionArea onClick={onContextMenuClick}>
          <CardContent>
            <Stack justifyContent="center" alignItems="flex-start" spacing={1}>
              <Typography variant="h6" sx={{ textAlign: 'left' }}>
                {formattedData?.screenName?.toString() || 'Unnamed'}
              </Typography>

              <Typography variant="caption">
                {formatMessage('connection.addedAt', {
                  datetime: relativeCreatedAt,
                })}
              </Typography>
            </Stack>

            <Box>
              <Stack direction="row" alignItems="center" spacing={1}>
                {verificationVisible && testCalled && testLoading && (
                  <>
                    <CircularProgress size={16} />
                    <Typography variant="caption">
                      {formatMessage('connection.testing')}
                    </Typography>
                  </>
                )}
                {verificationVisible &&
                  testCalled &&
                  !testLoading &&
                  verified && (
                    <>
                      <CheckCircleIcon fontSize="small" color="success" />
                      <Typography variant="caption">
                        {formatMessage('connection.testSuccessful')}
                      </Typography>
                    </>
                  )}
                {verificationVisible &&
                  testCalled &&
                  !testLoading &&
                  !verified && (
                    <>
                      <ErrorIcon fontSize="small" color="error" />
                      <Typography variant="caption">
                        {formatMessage('connection.testFailed')}
                      </Typography>
                    </>
                  )}
              </Stack>
            </Box>

            <Box sx={{ px: 2 }}>
              <Typography
                variant="caption"
                color="textSecondary"
                sx={{ display: ['none', 'inline-block'] }}
              >
                {formatMessage('connection.flowCount', {
                  count: countTranslation(flowCount),
                })}
              </Typography>
            </Box>

            <Box>
              <MoreHorizIcon ref={contextButtonRef} />
            </Box>
          </CardContent>
        </CardActionArea>
      </Card>

      {anchorEl && (
        <ConnectionContextMenu
          appKey={key}
          connectionId={id}
          onClose={handleClose}
          onMenuItemClick={onContextMenuAction}
          anchorEl={anchorEl}
        />
      )}
    </>
  )
}

export default AppConnectionRow

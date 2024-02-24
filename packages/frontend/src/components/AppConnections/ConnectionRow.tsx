import { useCallback, useRef, useState } from 'react'
import { useLazyQuery, useMutation } from '@apollo/client'
import { Card } from '@chakra-ui/react'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import Box from '@mui/material/Box'
import CardActionArea from '@mui/material/CardActionArea'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import { useToast } from '@opengovsg/design-system-react'

import {
  type FragmentType,
  getFragmentData,
  graphql,
} from 'graphql/__generated__'
import { DELETE_CONNECTION } from 'graphql/mutations/delete-connection'
import { TEST_CONNECTION } from 'graphql/queries/test-connection'
import { DateTime } from 'luxon'

import ConnectionContextMenu from './ConnectionContextMenu'

import { CardContent, Typography } from './style'

const AppConnections_ConnectionRow_ConnectionFragment = graphql(`
  fragment AppConnections_ConnectionRow_ConnectionFragment on Connection {
    id
    key
    formattedData {
      screenName
    }
    verified
    createdAt
    flowCount
  }
`)

type ConnectionRowProps = {
  connection: FragmentType<
    typeof AppConnections_ConnectionRow_ConnectionFragment
  >
}

function ConnectionRow({ connection }: ConnectionRowProps): JSX.Element {
  const toast = useToast()
  const [verificationVisible, setVerificationVisible] = useState(false)
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

  const { id, key, formattedData, verified, createdAt, flowCount } =
    getFragmentData(AppConnections_ConnectionRow_ConnectionFragment, connection)

  const contextButtonRef = useRef<SVGSVGElement | null>(null)
  const [anchorEl, setAnchorEl] = useState<SVGSVGElement | null>(null)

  const handleClose = () => {
    setAnchorEl(null)
  }

  const onContextMenuClick = () => setAnchorEl(contextButtonRef.current)
  const onContextMenuAction = useCallback(
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

        toast({
          title: 'The connection has been deleted.',
          status: 'success',
          duration: 3000,
          isClosable: true,
          position: 'bottom-right',
        })
      } else if (action.type === 'test') {
        setVerificationVisible(true)
        testConnection({ variables: { connectionId: id } })
      }
    },
    [deleteConnection, id, testConnection, toast],
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
                Added {relativeCreatedAt}
              </Typography>
            </Stack>

            <Box>
              <Stack direction="row" alignItems="center" spacing={1}>
                {verificationVisible && testCalled && testLoading && (
                  <>
                    <CircularProgress size={16} />
                    <Typography variant="caption">Testing...</Typography>
                  </>
                )}
                {verificationVisible &&
                  testCalled &&
                  !testLoading &&
                  verified && (
                    <>
                      <CheckCircleIcon fontSize="small" color="success" />
                      <Typography variant="caption">Test successful</Typography>
                    </>
                  )}
                {verificationVisible &&
                  testCalled &&
                  !testLoading &&
                  !verified && (
                    <>
                      <ErrorIcon fontSize="small" color="error" />
                      <Typography variant="caption">Test failed</Typography>
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
                <Typography variant="body1">{flowCount} pipes</Typography>
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

export default ConnectionRow

import type { IFlow } from '@plumber/types'

import * as React from 'react'
import { BiChevronRight } from 'react-icons/bi'
import { Link } from 'react-router-dom'
import { Card } from '@chakra-ui/react'
import CardActionArea from '@mui/material/CardActionArea'
import { Badge, IconButton } from '@opengovsg/design-system-react'
import FlowAppIcons from 'components/FlowAppIcons'
import FlowContextMenu from 'components/FlowContextMenu'
import * as URLS from 'config/urls'
import useFormatMessage from 'hooks/useFormatMessage'
import { DateTime } from 'luxon'

import { Apps, CardContent, ContextMenu, Title, Typography } from './style'

type FlowRowProps = {
  flow: IFlow
}

export default function FlowRow(props: FlowRowProps): React.ReactElement {
  const formatMessage = useFormatMessage()
  const contextButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null)
  const { flow } = props

  const handleClose = () => {
    setAnchorEl(null)
  }
  const onContextMenuClick = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    event.nativeEvent.stopImmediatePropagation()
    setAnchorEl(contextButtonRef.current)
  }

  const createdAt = DateTime.fromMillis(parseInt(flow.createdAt, 10))
  const updatedAt = DateTime.fromMillis(parseInt(flow.updatedAt, 10))
  const isUpdated = updatedAt > createdAt
  const relativeCreatedAt = createdAt.toRelative()
  const relativeUpdatedAt = updatedAt.toRelative()

  return (
    <>
      <Card
        // sx={{ mb: 1 }}
        mb={5}
        boxShadow="none"
        _hover={{ bg: '#FEF8FB' }}
        borderRadius="0"
        borderBottom="1px solid"
        borderBottomColor="base.divider.subtle"
      >
        <CardActionArea component={Link} to={URLS.FLOW(flow.id)}>
          <CardContent>
            <Apps direction="row" gap={1} sx={{ gridArea: 'apps' }}>
              <FlowAppIcons steps={flow.steps} />
            </Apps>

            <Title
              justifyContent="center"
              alignItems="flex-start"
              spacing={1}
              sx={{ gridArea: 'title' }}
            >
              <Typography variant="h6" noWrap>
                {flow?.name}
              </Typography>

              <Typography variant="caption">
                {isUpdated &&
                  formatMessage('flow.updatedAt', {
                    datetime: relativeUpdatedAt,
                  })}
                {!isUpdated &&
                  formatMessage('flow.createdAt', {
                    datetime: relativeCreatedAt,
                  })}
              </Typography>
            </Title>

            <ContextMenu>
              <Badge
                style={{
                  borderRadius: '3.125rem',
                  padding: '0.25rem 0.5rem',
                }}
                colorScheme={flow?.active ? 'success' : 'grey'}
                variant="subtle"
              >
                {formatMessage(flow?.active ? 'flow.published' : 'flow.draft')}
              </Badge>

              <IconButton
                aria-label="open context menu"
                icon={<BiChevronRight />}
                size="md"
                variant="clear"
                color="interaction.sub.default"
                ref={contextButtonRef}
                onClick={onContextMenuClick}
              />
            </ContextMenu>
          </CardContent>
        </CardActionArea>
      </Card>

      {anchorEl && (
        <FlowContextMenu
          flowId={flow.id}
          onClose={handleClose}
          anchorEl={anchorEl}
        />
      )}
    </>
  )
}

import type { IFlow } from '@plumber/types'

import * as React from 'react'
import { BiChevronRight, BiSolidCircle } from 'react-icons/bi'
import { Link } from 'react-router-dom'
import {
  Card,
  CardBody,
  Flex,
  Grid,
  GridItem,
  HStack,
  Text,
  VStack,
} from '@chakra-ui/react'
import {
  Badge,
  BadgeLeftIcon,
  IconButton,
} from '@opengovsg/design-system-react'
import FlowAppIcons from 'components/FlowAppIcons'
import FlowContextMenu from 'components/FlowContextMenu'
import * as URLS from 'config/urls'
import useFormatMessage from 'hooks/useFormatMessage'
import { DateTime } from 'luxon'

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
        boxShadow="none"
        _hover={{ bg: '#FEF8FB' }}
        borderRadius="0"
        borderBottom="1px solid"
        borderBottomColor="base.divider.medium"
      >
        <CardBody
          sx={{ cursor: 'pointer' }}
          p={0}
          as={Link}
          to={URLS.FLOW(flow.id)}
        >
          <Grid
            templateAreas={{
              base: `
                "apps menu"
                "title menu"
              `,
              sm: `"apps title menu"`,
            }}
            gridTemplateRows={{ base: 'auto auto', sm: 'auto' }}
            gridTemplateColumns={{
              base: 'minmax(0, auto) min-content',
              sm: 'calc(30px * 3 + 8px * 2) minmax(0, auto) min-content',
            }}
            gap={6}
            alignItems="center"
            p="1.5rem 2rem"
          >
            <GridItem area="apps">
              <HStack>
                <FlowAppIcons steps={flow.steps} />
              </HStack>
            </GridItem>

            <GridItem area="title">
              <VStack
                alignItems="flex-start"
                justifyContent="center"
                spacing={2}
              >
                <Text
                  whiteSpace="nowrap"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  display="inline-block"
                  w="100%"
                  maxW="85%"
                  textStyle="subhead-1"
                >
                  {flow?.name}
                </Text>
                <Text
                  display="inline-block"
                  w="100%"
                  maxW="85%"
                  color="base.content.medium"
                  textStyle="body-2"
                >
                  {isUpdated &&
                    formatMessage('flow.updatedAt', {
                      datetime: relativeUpdatedAt,
                    })}
                  {!isUpdated &&
                    formatMessage('flow.createdAt', {
                      datetime: relativeCreatedAt,
                    })}
                </Text>
              </VStack>
            </GridItem>
            <GridItem area="menu">
              <Flex alignItems="center" gap={1.5}>
                <Badge
                  style={{
                    borderRadius: '3.125rem',
                    padding: '0.25rem 0.5rem',
                  }}
                  colorScheme={flow?.active ? 'success' : 'grey'}
                  variant="subtle"
                >
                  <React.Fragment>
                    <BadgeLeftIcon boxSize={2} mr={2} as={BiSolidCircle} />
                    <Text textStyle="body-2">
                      {formatMessage(
                        flow?.active ? 'flow.published' : 'flow.draft',
                      )}
                    </Text>
                  </React.Fragment>
                </Badge>

                <IconButton
                  aria-label="open context menu"
                  icon={<BiChevronRight />}
                  size="md"
                  variant="clear"
                  color="interaction.sub.default"
                  ref={contextButtonRef}
                  onClick={onContextMenuClick}
                  border={0}
                />
              </Flex>
            </GridItem>
          </Grid>
        </CardBody>
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

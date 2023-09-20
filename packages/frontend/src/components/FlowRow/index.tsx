import type { IFlow } from '@plumber/types'

import { MouseEvent, ReactElement, useRef, useState } from 'react'
import { BiDotsHorizontalRounded } from 'react-icons/bi'
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
import { Badge, IconButton } from '@opengovsg/design-system-react'
import FlowAppIcons from 'components/FlowAppIcons'
import FlowContextMenu from 'components/FlowContextMenu'
import * as URLS from 'config/urls'
import { DateTime } from 'luxon'

type FlowRowProps = {
  flow: IFlow
}

export default function FlowRow(props: FlowRowProps): ReactElement {
  const contextButtonRef = useRef<HTMLButtonElement | null>(null)
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const { flow } = props

  const handleClose = () => {
    setAnchorEl(null)
  }
  const onContextMenuClick = (event: MouseEvent) => {
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
        _hover={{ bg: 'interaction.muted.neutral.hover' }}
        _active={{ bg: 'interaction.muted.neutral.active' }}
        borderRadius={0}
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
            py={6}
            px={8}
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
                  {isUpdated && `updated ${relativeUpdatedAt}`}
                  {!isUpdated && `created ${relativeCreatedAt}`}
                </Text>
              </VStack>
            </GridItem>
            <GridItem area="menu">
              <Flex alignItems="center" gap={1.5}>
                <Badge
                  py={1}
                  px={2}
                  colorScheme={flow?.active ? 'success' : 'grey'}
                  variant="subtle"
                >
                  <Text>{flow?.active ? 'Published' : 'Draft'}</Text>
                </Badge>

                <IconButton
                  aria-label="open context menu"
                  icon={<BiDotsHorizontalRounded />}
                  size="md"
                  variant="clear"
                  color="interaction.sub.default"
                  ref={contextButtonRef}
                  onClick={onContextMenuClick}
                  border={0}
                  colorScheme="neutral"
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

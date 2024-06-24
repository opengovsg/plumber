import type { IFlow } from '@plumber/types'

import { ReactElement } from 'react'
import { Link } from 'react-router-dom'
import {
  Card,
  CardBody,
  Flex,
  Grid,
  GridItem,
  HStack,
  Text,
  Tooltip,
  VStack,
} from '@chakra-ui/react'
import { Badge } from '@opengovsg/design-system-react'
import FlowAppIcons from 'components/FlowAppIcons'
import * as URLS from 'config/urls'
import { DateTime } from 'luxon'

import FlowContextMenu from './FlowContextMenu'

type FlowRowProps = {
  flow: IFlow
}

export default function FlowRow(props: FlowRowProps): ReactElement {
  const { flow } = props

  const hasLoadedOnce = flow?.config?.demoConfig?.hasLoadedOnce ?? true
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
        <Tooltip
          label={
            hasLoadedOnce
              ? ''
              : 'Click for a demo of how to send an email notification to a respondent when they submit your form.'
          }
          aria-label="demo flow tooltip"
          placement="bottom-start"
          hasArrow={false}
          openDelay={300}
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
                    colorScheme={flow?.active ? 'success' : 'grey'}
                    variant="subtle"
                  >
                    <Text>{flow?.active ? 'Published' : 'Draft'}</Text>
                  </Badge>

                  <FlowContextMenu flow={flow} />
                </Flex>
              </GridItem>
            </Grid>
          </CardBody>
        </Tooltip>
      </Card>
    </>
  )
}

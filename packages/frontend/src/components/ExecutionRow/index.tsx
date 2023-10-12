import type { IExecution } from '@plumber/types'

import { ReactElement } from 'react'
import { BiChevronRight } from 'react-icons/bi'
import { Link } from 'react-router-dom'
import {
  Card,
  CardBody,
  Flex,
  Grid,
  GridItem,
  HStack,
  Icon,
  Text,
  VStack,
} from '@chakra-ui/react'
import { Badge } from '@opengovsg/design-system-react'
import { StatusType } from 'components/ExecutionStatusMenu'
import FlowAppIcons from 'components/FlowAppIcons'
import * as URLS from 'config/urls'
import { DateTime } from 'luxon'

type ExecutionRowProps = {
  execution: IExecution
}

export default function ExecutionRow(props: ExecutionRowProps): ReactElement {
  const { execution } = props
  const { flow } = execution

  const createdAt = DateTime.fromMillis(parseInt(execution.createdAt, 10))
  const relativeCreatedAt = createdAt.toRelative()

  return (
    <Link to={URLS.EXECUTION(execution.id)} data-test="execution-row">
      <Card
        boxShadow="none"
        _hover={{ bg: 'interaction.muted.neutral.hover' }}
        _active={{ bg: 'interaction.muted.neutral.active' }}
        borderRadius={0}
        borderBottom="1px solid"
        borderBottomColor="base.divider.medium"
      >
        <CardBody p={0}>
          <Grid
            templateAreas={{
              base: `
                "apps arrow-container"
                "title arrow-container"
              `,
              sm: `"apps title arrow-container"`,
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
                  {flow.name}
                </Text>
                <Text
                  display="inline-block"
                  w="100%"
                  maxW="85%"
                  color="base.content.medium"
                  textStyle="body-2"
                >
                  executed {relativeCreatedAt}
                </Text>
              </VStack>
            </GridItem>
            <GridItem area="arrow-container">
              <Flex alignItems="center" gap={4}>
                <Badge
                  py={1}
                  px={2}
                  colorScheme={
                    execution.status === StatusType.Success
                      ? 'success'
                      : execution.status === StatusType.Failure
                      ? 'critical'
                      : 'grey'
                  }
                  variant="subtle"
                >
                  <Text>
                    {execution.status === StatusType.Success
                      ? 'Success'
                      : execution.status === StatusType.Failure
                      ? 'Failure'
                      : 'Waiting'}
                  </Text>
                </Badge>

                <Icon boxSize={5} as={BiChevronRight} />
              </Flex>
            </GridItem>
          </Grid>
        </CardBody>
      </Card>
    </Link>
  )
}

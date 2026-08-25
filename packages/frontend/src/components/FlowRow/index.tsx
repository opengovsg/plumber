import type { IFlow } from '@plumber/types'

import { ReactElement } from 'react'
import { BiChevronRight, BiGroup } from 'react-icons/bi'
import { Link } from 'react-router-dom'
import {
  Box,
  Card,
  CardBody,
  Flex,
  HStack,
  Icon,
  Spacer,
  Text,
  VStack,
} from '@chakra-ui/react'
import { Badge, IconButton } from '@opengovsg/design-system-react'
import { DateTime } from 'luxon'

import FlowAppIcons from '@/components/FlowAppIcons'
import * as URLS from '@/config/urls'
import {
  FOLDER_COLORS,
  FolderColor,
} from '@/pages/Flows/components/FolderSidebar/constants'

import FlowContextMenu from './FlowContextMenu'

// `IFlow` (from `@plumber/types`) doesn't carry `folder` yet, so it's
// intersected in locally rather than widening the shared type for a
// single-field, GraphQL-only addition.
export type FlowWithFolder = IFlow & {
  folder?: { id: string; name: string; color: string } | null
}

type FlowRowProps = {
  flow: FlowWithFolder
  isExecution?: boolean
  showMenu?: boolean
  showTimestamp?: boolean
  isShared?: boolean
  // Suppress the chip when the pipe list is already scoped to one folder
  // (e.g. viewing that folder itself) - the chip would be redundant there.
  showFolderChip?: boolean
}

function FolderChip({ folder }: { folder: { name: string; color: string } }) {
  const colorToken = FOLDER_COLORS[folder.color as FolderColor]
  return (
    <Flex
      align="center"
      gap={1.5}
      flexShrink={0}
      borderRadius="full"
      bg={colorToken.subtle}
      px={2.5}
      py={1}
    >
      <Box
        boxSize="6px"
        borderRadius="full"
        bg={colorToken.dot}
        flexShrink={0}
      />
      <Text
        textStyle="body-2"
        color="base.content.default"
        isTruncated
        maxW="140px"
      >
        {folder.name}
      </Text>
    </Flex>
  )
}

function FlowRowTitle({
  flow,
  showTimestamp,
  isShared,
}: Pick<FlowRowProps, 'flow' | 'showTimestamp' | 'isShared'>) {
  const createdAt = DateTime.fromMillis(parseInt(flow.createdAt, 10))
  const updatedAt = DateTime.fromMillis(parseInt(flow.updatedAt, 10))
  const isUpdated = updatedAt > createdAt
  const relativeCreatedAt = createdAt.toRelative()
  const relativeUpdatedAt = updatedAt.toRelative()
  return (
    <VStack alignItems="flex-start" justifyContent="center" maxW="100%">
      <Flex alignItems="center" gap={2} w="100%">
        <Text
          whiteSpace="nowrap"
          overflow="hidden"
          textOverflow="ellipsis"
          display="inline-block"
          maxW="100%"
          textStyle="subhead-1"
        >
          {flow?.name}
        </Text>
        {isShared && <Icon boxSize={5} as={BiGroup} />}
      </Flex>
      {showTimestamp && (
        <Text
          display="inline-block"
          w="100%"
          whiteSpace="nowrap"
          color="base.content.medium"
          textStyle="body-2"
        >
          {isUpdated && `updated ${relativeUpdatedAt}`}
          {!isUpdated && `created ${relativeCreatedAt}`}
        </Text>
      )}
    </VStack>
  )
}

export default function FlowRow(props: FlowRowProps): ReactElement {
  const {
    flow,
    showMenu = true,
    isExecution = false,
    showTimestamp = true,
    showFolderChip = true,
  } = props

  // NOTE: check is for greater than 1 because collaborators includes the owner
  const isShared = !!(
    flow?.collaborators?.length && flow?.collaborators?.length > 1
  )

  return (
    <>
      <Card
        boxShadow="none"
        _hover={{ bg: 'interaction.muted.neutral.hover' }}
        _active={{ bg: 'interaction.muted.neutral.active' }}
        borderRadius={0}
        borderBottom="1px solid"
        borderBottomColor="base.divider.medium"
        minH={100}
      >
        <CardBody
          cursor="pointer"
          as={Link}
          to={
            isExecution ? URLS.EXECUTIONS_FOR_FLOW(flow.id) : URLS.FLOW(flow.id)
          }
          flex={1}
          py={6}
          px={{ base: 3, md: 8 }}
          display="flex"
          flexDir={{ base: 'column', md: 'row' }}
          alignItems="stretch"
          minWidth="100%"
          overflow="hidden"
        >
          <Flex gap={6} flex={1} alignItems="center">
            <HStack minWidth="120px">
              <FlowAppIcons steps={flow.steps} />
            </HStack>

            <Box display={{ base: 'none', md: 'inline-flex' }} minWidth="0">
              <FlowRowTitle
                flow={flow}
                showTimestamp={showTimestamp}
                isShared={isShared}
              />
            </Box>

            <Spacer />

            <Flex alignItems="center" gap={1.5} justifyContent="flex-end">
              {showFolderChip && flow.folder && (
                <FolderChip folder={flow.folder} />
              )}
              {isShared && (
                <Badge
                  colorScheme="secondary"
                  size="sm"
                  variant="subtle"
                  textTransform="capitalize"
                >
                  {flow.role}
                </Badge>
              )}
              <Badge
                colorScheme={flow?.active ? 'success' : 'grey'}
                variant="subtle"
              >
                <Text>{flow?.active ? 'Published' : 'Draft'}</Text>
              </Badge>

              {showMenu ? (
                <FlowContextMenu flow={flow} />
              ) : (
                <IconButton
                  aria-label="View Flow"
                  colorScheme="secondary"
                  icon={<BiChevronRight />}
                  variant="clear"
                  _hover={{}}
                />
              )}
            </Flex>
          </Flex>
          <Box display={{ base: 'flex', md: 'none' }} mt={4}>
            <FlowRowTitle flow={flow} showTimestamp={showTimestamp} />
          </Box>
        </CardBody>
      </Card>
    </>
  )
}

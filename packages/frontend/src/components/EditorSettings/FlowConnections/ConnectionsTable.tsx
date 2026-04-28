import { IFlow } from '@plumber/types'

import { useContext } from 'react'
import { BiTrash } from 'react-icons/bi'
import { useQuery } from '@apollo/client'
import {
  Box,
  Center,
  Flex,
  IconButton,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import { Tag } from '@opengovsg/design-system-react'

import AppIcon from '@/components/AppIcon'
import PrimarySpinner from '@/components/PrimarySpinner'
import { EditorSettingsContext } from '@/contexts/EditorSettings'
import { GET_FLOW_CONNECTIONS } from '@/graphql/queries/get-flow-connections'

interface SharedConnection {
  addedBy: string
  appName: string
  appIconUrl: string
  connectionName: string
  connectionId: string
  connectionType: 'connection' | 'table'
  positions: number[]
}

interface TableRowProps {
  connection: SharedConnection
  flow: IFlow
  hasEditPermission: boolean
}

const COLUMNS = ['App', 'Connection name', 'Created by', 'Status', '']

const StatusTag = ({ inUse }: { inUse: boolean }) => {
  if (inUse) {
    return <Tag colorScheme="success">In use</Tag>
  }
  return (
    <Tag bg="interaction.sub-subtle.default" color="base.divider.strong">
      Not in use
    </Tag>
  )
}

const TableHeader = () => {
  return (
    <Thead>
      <Tr bg="interaction.neutral-subtle.default">
        {COLUMNS.map((column) => (
          <Th key={column}>{column}</Th>
        ))}
      </Tr>
    </Thead>
  )
}

const TableRow = (props: TableRowProps) => {
  const { connection, hasEditPermission } = props
  const {
    connectionId,
    connectionName,
    addedBy,
    positions,
    appName,
    appIconUrl,
  } = connection

  const isInUse = positions.length > 0

  return (
    <Tr key={connectionId} color={isInUse ? undefined : 'base.divider.strong'}>
      <Td>
        <Flex alignItems="center" gap={2}>
          <AppIcon
            name={appName}
            url={appIconUrl}
            opacity={isInUse ? 1 : 0.5}
            filter={isInUse ? undefined : 'grayscale(100%)'}
            height="20px"
            width="20px"
          />
          <Box display={{ base: 'none', md: 'block' }}>{appName}</Box>
        </Flex>
      </Td>

      <Td>
        <Box
          overflow="hidden"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
          maxW={{ base: '100px', md: '300px' }}
        >
          {connectionName}
        </Box>
      </Td>
      <Td>{addedBy}</Td>
      <Td>
        <StatusTag inUse={isInUse} />
      </Td>
      <Td>
        {/* TODO: Add the delete functionality */}
        {hasEditPermission && (
          <IconButton
            onClick={(event) => {
              event.stopPropagation()
            }}
            colorScheme="critical"
            variant="clear"
            aria-label="Delete flow connection"
            icon={<BiTrash />}
          />
        )}
      </Td>
    </Tr>
  )
}

export default function ConnectionsTable() {
  const { flow, hasEditPermission } = useContext(EditorSettingsContext)

  const { data: flowConnectionsData, loading: flowConnectionsLoading } =
    useQuery(GET_FLOW_CONNECTIONS, {
      variables: {
        flowId: flow.id,
      },
    })

  const flowConnections: SharedConnection[] =
    flowConnectionsData?.getFlowConnections || []

  const processedConnections = flowConnections.map((flowConnection) => {
    const matchingSteps =
      flow.steps?.filter((step) => {
        if (flowConnection.connectionType === 'table') {
          return step?.parameters?.tableId === flowConnection.connectionId
        }
        return step?.connection?.id === flowConnection.connectionId
      }) ?? []

    return {
      ...flowConnection,
      positions: matchingSteps.map((step) => step.position),
    }
  })

  const sortedConnections = processedConnections.sort((a, b) => {
    // First, sort by whether connection is in use (in use first, not in use last)
    const aInUse = a.positions.length > 0 ? 0 : 1
    const bInUse = b.positions.length > 0 ? 0 : 1
    if (aInUse !== bInUse) {
      return aInUse - bInUse
    }

    // Then sort by app name
    const appCompare = a.appName.localeCompare(b.appName)
    if (appCompare !== 0) {
      return appCompare
    }

    // Finally sort by connection name
    return a.connectionName.localeCompare(b.connectionName)
  })

  if (flowConnectionsLoading) {
    return (
      <Center>
        <PrimarySpinner margin="auto" fontSize="4xl" />
      </Center>
    )
  }

  return (
    <TableContainer>
      <Table variant="simple" colorScheme="secondary">
        <TableHeader />
        <Tbody>
          {sortedConnections.map((connection) => (
            <TableRow
              key={connection.connectionId}
              connection={connection}
              flow={flow}
              hasEditPermission={hasEditPermission}
            />
          ))}
        </Tbody>
      </Table>
    </TableContainer>
  )
}

import { IFlow } from '@plumber/types'

import { useContext, useRef, useState } from 'react'
import { useQuery } from '@apollo/client'
import {
  Box,
  Center,
  Flex,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tooltip,
  Tr,
} from '@chakra-ui/react'
import { Tag } from '@opengovsg/design-system-react'

import AppIcon from '@/components/AppIcon'
import PrimarySpinner from '@/components/PrimarySpinner'
import { EditorSettingsContext } from '@/contexts/EditorSettings'
import { GET_FLOW_CONNECTIONS } from '@/graphql/queries/get-flow-connections'

import DeleteFlowConnectionButton from './DeleteFlowConnectionButton'

export interface SharedConnection {
  addedBy: string
  appName: string
  appIconUrl: string
  connectionName: string
  connectionId: string
  connectionType: 'connection' | 'table'
  positions: number[]
  isDeletable: boolean
}

interface TableRowProps {
  connection: SharedConnection
  flow: IFlow
  hasEditPermission: boolean
}

const COLUMNS = ['App', 'Connection name', 'Created by', 'Status', '']

const StatusTag = ({ inUse }: { inUse: boolean }) => {
  if (inUse) {
    return (
      <Tag colorScheme="success" _active={{}} _hover={{}}>
        In use
      </Tag>
    )
  }
  return (
    <Tag
      bg="interaction.sub-subtle.default"
      color="base.divider.strong"
      _active={{}}
      _hover={{}}
    >
      Not in use
    </Tag>
  )
}

const OverflowTooltip = ({ label }: { label: string }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  return (
    <Tooltip label={label} isDisabled={!isOverflowing}>
      <Box
        ref={ref}
        overflow="hidden"
        textOverflow="ellipsis"
        whiteSpace="nowrap"
        maxW={{ base: '100px', md: '300px' }}
        onMouseEnter={() => {
          if (ref.current) {
            setIsOverflowing(ref.current.scrollWidth > ref.current.clientWidth)
          }
        }}
      >
        {label}
      </Box>
    </Tooltip>
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
  const { connection, flow, hasEditPermission } = props
  const {
    connectionId,
    connectionName,
    addedBy,
    positions,
    appName,
    appIconUrl,
    isDeletable,
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
        <OverflowTooltip label={connectionName} />
      </Td>
      <Td>{addedBy}</Td>
      <Td>
        <StatusTag inUse={isInUse} />
      </Td>
      <Td>
        {hasEditPermission && isDeletable && !isInUse && (
          <DeleteFlowConnectionButton flow={flow} connection={connection} />
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

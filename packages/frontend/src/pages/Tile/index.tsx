import { ITableMetadata, ITableRow } from '@plumber/types'

import { FaChevronRight } from 'react-icons/fa'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Center,
  Flex,
  Icon,
  Spinner,
} from '@chakra-ui/react'
import * as URLS from 'config/urls'
import { GET_ALL_ROWS } from 'graphql/queries/get-all-rows'
import { GET_TABLE } from 'graphql/queries/get-table'

import Table from './components/Table'
import { TableContextProvider } from './contexts/TableContext'
import { TABLE_BANNER_HEIGHT } from './constants'

export default function Tile(): JSX.Element {
  const { tileId: tableId } = useParams<{ tileId: string }>()

  const { data: getTableData } = useQuery<{
    getTable: ITableMetadata
  }>(GET_TABLE, {
    variables: {
      tableId,
    },
  })

  const { data: getAllRowsData } = useQuery<{
    getAllRows: ITableRow[]
  }>(GET_ALL_ROWS, {
    variables: {
      tableId,
    },
    fetchPolicy: 'network-only',
  })

  if (!getTableData?.getTable || !getAllRowsData?.getAllRows) {
    return (
      <Center height="100vh">
        <Spinner size="xl" thickness="4px" color="primary.500" margin="auto" />
      </Center>
    )
  }

  const { id, name, columns } = getTableData.getTable
  const rows = getAllRowsData.getAllRows

  return (
    <Flex
      flexDir={{ base: 'column' }}
      justifyContent="space-between"
      alignItems="stretch"
    >
      <Flex px={8} h={TABLE_BANNER_HEIGHT} alignItems="center">
        <Breadcrumb
          spacing={4}
          separator={<Icon as={FaChevronRight} color="secondary.300" h={3} />}
        >
          <BreadcrumbItem>
            <BreadcrumbLink as={Link} to={URLS.TILES}>
              Tiles
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <BreadcrumbLink>{name}</BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>
      </Flex>
      <TableContextProvider
        tableId={id}
        tableColumns={columns}
        tableRows={rows}
      >
        <Table />
      </TableContextProvider>
    </Flex>
  )
}

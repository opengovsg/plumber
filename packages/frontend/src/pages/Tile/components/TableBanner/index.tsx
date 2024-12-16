import { Flex, Text } from '@chakra-ui/react'

import { TABLE_BANNER_HEIGHT } from '../../constants'
import { useTableContext } from '../../contexts/TableContext'

import BreadCrumb from './BreadCrumb'
import EditMode from './EditMode'
import ImportExportToolbar from './ImportExportToolbar'
import RefreshButton from './RefreshButton'

function TableBanner() {
  const { tableName, role, isFetching } = useTableContext()

  return (
    <Flex
      px={{ base: 4, md: 8 }}
      h={TABLE_BANNER_HEIGHT}
      alignItems="center"
      justifyContent="space-between"
      overflow="hidden"
      zIndex={10}
    >
      <Flex alignItems="center" gap={4}>
        {role ? <BreadCrumb /> : <Text textStyle="subhead-1">{tableName}</Text>}
        <EditMode />
      </Flex>
      <Flex gap={2}>
        {isFetching && <RefreshButton />}
        <ImportExportToolbar />
      </Flex>
    </Flex>
  )
}

export default TableBanner

import { Flex, Text } from '@chakra-ui/react'

import { TABLE_BANNER_HEIGHT } from '../../constants'
import { useTableContext } from '../../contexts/TableContext'

import BreadCrumb from './BreadCrumb'
import ImportExportToolbar from './ImportExportToolbar'

function TableBanner() {
  const { tableName, hasEditPermission } = useTableContext()

  return (
    <Flex
      px={8}
      h={TABLE_BANNER_HEIGHT}
      alignItems="center"
      justifyContent="space-between"
      overflow="hidden"
      zIndex={10}
    >
      {hasEditPermission ? (
        <BreadCrumb />
      ) : (
        <Text textStyle="subhead-1">{tableName}</Text>
      )}
      <ImportExportToolbar />
    </Flex>
  )
}

export default TableBanner

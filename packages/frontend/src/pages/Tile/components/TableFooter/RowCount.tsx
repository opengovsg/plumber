import { Flex, Text } from '@chakra-ui/react'
import { Spinner } from '@opengovsg/design-system-react'

import { BORDER_COLOR } from '../../constants'
import { useTableContext } from '../../contexts/TableContext'

interface RowCountProps {
  rowCount: number
  rowSelection: Record<string, boolean>
}

export default function RowCount({ rowCount, rowSelection }: RowCountProps) {
  const { isFetching } = useTableContext()

  const numRowsSelected = Object.keys(rowSelection).length
  const rowCountToShow = numRowsSelected || rowCount

  return (
    <Flex
      alignItems="center"
      justifyContent="center"
      borderRightWidth={1}
      bg={numRowsSelected ? 'primary.50' : 'white'}
      borderColor={BORDER_COLOR.DEFAULT}
      px={4}
    >
      {isFetching && <Spinner mr={1} />}
      <Text textStyle="body-2" whiteSpace="nowrap">
        {rowCountToShow}
        {' row' +
          (rowCountToShow > 1 ? 's' : '') +
          (numRowsSelected ? ' selected' : '')}
      </Text>
    </Flex>
  )
}

import { BiErrorCircle } from 'react-icons/bi'
import { Flex, Icon, Text } from '@chakra-ui/react'
import { Spinner } from '@opengovsg/design-system-react'

import { BORDER_COLOR } from '../../constants'
import { useTableContext } from '../../contexts/TableContext'

interface RowCountProps {
  rowCount: number
  rowSelection: Record<string, boolean>
}

export default function RowCount({ rowCount, rowSelection }: RowCountProps) {
  const { isFetching, isThroughputError } = useTableContext()

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
      gap={1}
    >
      {isFetching && <Spinner />}
      {!isFetching && isThroughputError && (
        <Icon boxSize={4} as={BiErrorCircle} color="red.500" />
      )}
      <Text textStyle="body-2" whiteSpace="nowrap">
        {rowCountToShow}
        {' row' +
          (rowCountToShow > 1 ? 's' : '') +
          (numRowsSelected ? ' selected' : '')}
      </Text>
    </Flex>
  )
}

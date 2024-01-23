import { Flex, Text } from '@chakra-ui/react'

import { BORDER_COLOR } from '../../constants'

interface RowCountProps {
  rowCount: number
  rowSelection: Record<string, boolean>
}

export default function RowCount({ rowCount, rowSelection }: RowCountProps) {
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
      <Text textStyle="body-2">
        {rowCountToShow}
        {' row' +
          (rowCountToShow > 1 ? 's' : '') +
          (numRowsSelected ? ' selected' : '')}
      </Text>
    </Flex>
  )
}

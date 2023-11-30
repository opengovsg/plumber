import { useEffect, useRef } from 'react'
import { Flex } from '@chakra-ui/react'
import { HeaderContext } from '@tanstack/react-table'

import { BORDER_COLOR, Z_INDEX_CELL } from '../../constants'
import { GenericRowData } from '../../types'

export default function CheckboxHeaderCell({
  column,
  table,
}: HeaderContext<GenericRowData, unknown>) {
  const isAllRowsSelected = table.getIsAllRowsSelected()
  const isSomeRowsSelected = table.getIsSomeRowsSelected()
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = isSomeRowsSelected
    }
  }, [isSomeRowsSelected])

  return (
    <Flex
      as="label"
      w={column.getSize() + 'px'}
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      position="sticky"
      left={0}
      zIndex={Z_INDEX_CELL.CHECKBOX}
      borderRightWidth={'0.5px'}
      borderColor={BORDER_COLOR.DEFAULT}
    >
      <input
        ref={ref}
        style={{
          cursor: 'pointer',
          accentColor: 'var(--chakra-colors-primary-500)',
        }}
        type="checkbox"
        checked={isAllRowsSelected}
        onChange={table.getToggleAllRowsSelectedHandler()}
      />
    </Flex>
  )
}

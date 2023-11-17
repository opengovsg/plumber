import { useCallback } from 'react'
import { Box } from '@chakra-ui/react'
import { Header } from '@tanstack/react-table'

import { useUpdateTable } from '../../hooks/useUpdateTable'
import { GenericRowData } from '../../types'

interface ColumnResizerProps {
  header: Header<GenericRowData, unknown>
}

export default function ColumnResizer({ header }: ColumnResizerProps) {
  const { updateColumns } = useUpdateTable()

  const onResizeEnd = useCallback(async () => {
    const newSize = header.getSize()
    await updateColumns([{ id: header.id, config: { width: newSize } }])
  }, [header, updateColumns])

  return (
    <Box
      w={2}
      h="100%"
      cursor="col-resize"
      _hover={{
        bg: 'primary.800',
      }}
      _active={{
        bg: 'primary.800',
      }}
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      onMouseUp={onResizeEnd}
      onTouchEnd={onResizeEnd}
    />
  )
}

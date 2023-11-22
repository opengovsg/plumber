import { useCallback, useMemo } from 'react'
import { Box } from '@chakra-ui/react'
import { Header } from '@tanstack/react-table'

import { useUpdateTable } from '../../hooks/useUpdateTable'
import { GenericRowData } from '../../types'

interface ColumnResizerProps {
  header: Header<GenericRowData, unknown>
}

export default function ColumnResizer({ header }: ColumnResizerProps) {
  const { updateColumns } = useUpdateTable()

  const onMouseUp = useCallback(() => {
    const newSize = header.getSize()
    updateColumns([{ id: header.id, config: { width: newSize } }])
  }, [header, updateColumns])

  const onResizeStart = useMemo(() => {
    // this is necessary because mouse up outside of the element will not be registered otherwise
    document.addEventListener('mouseup', onMouseUp, { once: true })
    return header.getResizeHandler()
  }, [header, onMouseUp])

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
      onMouseDown={onResizeStart}
    />
  )
}
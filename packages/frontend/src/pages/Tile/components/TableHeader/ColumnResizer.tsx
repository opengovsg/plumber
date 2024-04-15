import { MouseEvent, useCallback, useMemo } from 'react'
import { Box } from '@chakra-ui/react'
import { Header } from '@tanstack/react-table'

import { HEADER_COLOR } from '../../constants'
import { useTableContext } from '../../contexts/TableContext'
import { useUpdateTable } from '../../hooks/useUpdateTable'
import { GenericRowData } from '../../types'

interface ColumnResizerProps {
  header: Header<GenericRowData, unknown>
}

export default function ColumnResizer({ header }: ColumnResizerProps) {
  const { updateColumns } = useUpdateTable()
  const { mode } = useTableContext()
  const isEditMode = mode === 'edit'

  const onMouseUp = useCallback(() => {
    const newSize = header.getSize()
    updateColumns([{ id: header.id, config: { width: newSize } }])
  }, [header, updateColumns])

  const resizeHandler = useMemo(() => {
    return header.getResizeHandler()
  }, [header])

  const onResizeStart = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      // this is necessary because mouse up outside of the element will not be registered otherwise
      if (isEditMode) {
        document.addEventListener('mouseup', onMouseUp, { once: true })
      }
      return resizeHandler(e)
    },
    [isEditMode, onMouseUp, resizeHandler],
  )

  return (
    <Box
      w={2}
      h="100%"
      cursor="col-resize"
      // this is necessary to prevent scrolling when resizing
      userSelect={'none'}
      _hover={{
        bg: HEADER_COLOR.HOVER,
      }}
      _active={{
        bg: HEADER_COLOR.HOVER,
      }}
      onMouseDown={onResizeStart}
    />
  )
}

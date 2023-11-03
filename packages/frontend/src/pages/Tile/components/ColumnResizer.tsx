import { Box } from '@chakra-ui/react'
import { Header } from '@tanstack/react-table'

import { GenericRowData } from '../types'

interface ColumnResizerProps {
  header: Header<GenericRowData, unknown>
}

export default function ColumnResizer({ header }: ColumnResizerProps) {
  return (
    <Box
      position="absolute"
      right={0}
      w={2}
      bottom={0}
      top={0}
      cursor="col-resize"
      _hover={{
        bg: 'primary.600',
      }}
      _active={{
        bg: 'primary.500',
      }}
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
    />
  )
}

import { BiTrash } from 'react-icons/bi'
import { Button } from '@chakra-ui/react'

import { ROW_HEIGHT } from '@/pages/Tile/constants'

import { useContextMenuContext } from '../../contexts/ContextMenuContext'
import { useTableContext } from '../../contexts/TableContext'

export default function DeleteRowsButton() {
  const { mode } = useTableContext()
  const { onDeleteRows } = useContextMenuContext()

  const isViewMode = mode === 'view'

  if (isViewMode) {
    return null
  }

  return (
    <div
      style={{
        height: ROW_HEIGHT.FOOTER,
        maxHeight: ROW_HEIGHT.FOOTER,
        overflow: 'visible',
      }}
    >
      <Button
        variant="clear"
        size="xs"
        h="100%"
        colorScheme="critical"
        leftIcon={<BiTrash />}
        onClick={() => onDeleteRows()}
      >
        Delete rows
      </Button>
    </div>
  )
}

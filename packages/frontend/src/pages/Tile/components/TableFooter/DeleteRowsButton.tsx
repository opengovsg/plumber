import { useState } from 'react'
import { BsTrash } from 'react-icons/bs'
import { Button } from '@chakra-ui/react'
import { ROW_HEIGHT } from 'pages/Tile/constants'

import { useTableContext } from '../../contexts/TableContext'

import DeleteRowsModal from './DeleteRowsModal'

interface DeleteRowsButtonProps {
  rowSelection: Record<string, boolean>
  removeRows: (rowIds: string[]) => void
}

export default function DeleteRowsButton({
  rowSelection,
  removeRows,
}: DeleteRowsButtonProps) {
  const { mode } = useTableContext()
  const isViewMode = mode === 'view'

  const rowsSelected = Object.keys(rowSelection)

  const [isDialogOpen, setIsDialogOpen] = useState(false)

  if (isViewMode) {
    return null
  }

  return (
    <div
      style={{
        height: ROW_HEIGHT.FOOTER,
        maxHeight: ROW_HEIGHT.FOOTER,
        overflow: 'visible',
        visibility: rowsSelected.length ? 'visible' : 'hidden',
      }}
    >
      <Button
        variant="clear"
        size="xs"
        h="100%"
        color="red.500"
        leftIcon={<BsTrash />}
        onClick={() => setIsDialogOpen(true)}
      >
        Delete
      </Button>
      {/* lazy load the dialog */}
      {isDialogOpen && (
        <DeleteRowsModal
          rowIdsToDelete={rowsSelected}
          removeRows={removeRows}
          onClose={() => setIsDialogOpen(false)}
        />
      )}
    </div>
  )
}

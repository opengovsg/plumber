import { useCallback } from 'react'
import { BsTrash } from 'react-icons/bs'
import { Button } from '@chakra-ui/react'

import { useDeleteRows } from '../../hooks/useDeleteRows'

interface DeleteRowsButtonProps {
  rowSelection: Record<string, boolean>
  removeRows: (rows: string[]) => void
}

export default function DeleteRowsButton({
  rowSelection,
  removeRows,
}: DeleteRowsButtonProps) {
  const rowsSelected = Object.keys(rowSelection)

  const { deleteRows, rowsDeleting } = useDeleteRows()

  const onClick = useCallback(async () => {
    await deleteRows(rowsSelected)
    removeRows(rowsSelected)
  }, [deleteRows, removeRows, rowsSelected])

  if (!rowsSelected.length) {
    return null
  }
  return (
    <Button
      variant="clear"
      size="xs"
      h="100%"
      leftIcon={<BsTrash />}
      isLoading={!!rowsDeleting}
      onClick={onClick}
    >
      Delete {rowsSelected.length} row{rowsSelected.length > 1 ? 's' : ''}
    </Button>
  )
}

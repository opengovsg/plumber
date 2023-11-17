import { useCallback } from 'react'
import { BsTrash } from 'react-icons/bs'
import { Button } from '@chakra-ui/react'
import { Table } from '@tanstack/react-table'

import { useDeleteRows } from '../../hooks/useDeleteRows'
import { GenericRowData } from '../../types'

interface DeleteRowsButtonProps {
  table: Table<GenericRowData>
}

export default function DeleteRowsButton({ table }: DeleteRowsButtonProps) {
  const rowSelection = table.getState().rowSelection
  const rowsSelected = Object.keys(rowSelection)

  const { deleteRows, rowsDeleting } = useDeleteRows()

  const onClick = useCallback(async () => {
    await deleteRows(rowsSelected)
    table.options.meta?.removeRows(rowsSelected)
    table.setRowSelection({})
  }, [deleteRows, rowsSelected, table])

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

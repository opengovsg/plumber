import { useCallback, useState } from 'react'
import { useMutation } from '@apollo/client'

import { DELETE_ROWS } from '@/graphql/mutations/tiles/delete-rows'

import { useTableContext } from '../contexts/TableContext'

interface DeleteRowsInput {
  input: {
    tableId: string
    rowIds: string[]
  }
}

interface DeleteRowsOutput {
  deleteRows: string[]
}

export function useDeleteRows() {
  const { tableId } = useTableContext()
  const [rowsDeleting, setRowsDeleting] = useState<Set<string>>()

  const [deleteRowsMutation] = useMutation<DeleteRowsOutput, DeleteRowsInput>(
    DELETE_ROWS,
    {
      onCompleted: () => {
        setRowsDeleting(undefined)
      },
    },
  )

  const deleteRows = useCallback(
    async (rowIds: string[]) => {
      setRowsDeleting(new Set(rowIds))

      await deleteRowsMutation({
        variables: {
          input: {
            tableId,
            rowIds,
          },
        },
      })
    },
    [deleteRowsMutation, tableId],
  )
  return {
    rowsDeleting,
    deleteRows,
  }
}

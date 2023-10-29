import { useCallback, useState } from 'react'
import { useMutation } from '@apollo/client'
import { UPDATE_ROW } from 'graphql/mutations/update-row'

import { GenericRowData } from '../types'

interface UpdateRowInput {
  input: {
    tableId: string
    rowId: string
    data: Record<string, string>
  }
}

interface UpdateRowOutput {
  updateRow: string
}

export function useUpdateRow(tableId: string) {
  const [rowsUpdating, setRowsUpdating] = useState<Record<string, boolean>>({})

  const [updateRowMutation] = useMutation<UpdateRowOutput, UpdateRowInput>(
    UPDATE_ROW,
    {
      onCompleted: ({ updateRow: updatedRowId }) => {
        setRowsUpdating((state) => {
          state[updatedRowId] = false
          return { ...state }
        })
        setTimeout(() => {
          setRowsUpdating((state) => {
            delete state[updatedRowId]
            return { ...state }
          })
        }, 1000)
      },
    },
  )

  const updateRow = useCallback(
    async (updatedRow: GenericRowData) => {
      const { rowId, ...data } = updatedRow
      setRowsUpdating((oldState) => {
        oldState[updatedRow.rowId] = true
        return { ...oldState }
      })
      return updateRowMutation({
        variables: {
          input: {
            tableId,
            rowId,
            data,
          },
        },
      })
    },
    [tableId, updateRowMutation],
  )
  return {
    rowsUpdating,
    updateRow,
  }
}

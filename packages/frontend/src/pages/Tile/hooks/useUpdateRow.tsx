import { Dispatch, SetStateAction, useCallback, useState } from 'react'
import { useMutation } from '@apollo/client'

import { UPDATE_ROW } from '@/graphql/mutations/tiles/update-row'

import { useTableContext } from '../contexts/TableContext'
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

export function useUpdateRow(
  setData: Dispatch<SetStateAction<GenericRowData[]>>,
) {
  const { tableId } = useTableContext()
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
        oldState[rowId] = true
        return { ...oldState }
      })
      setData((oldData) => {
        const rowIndex = oldData.findIndex((row) => row.rowId === rowId)
        oldData[rowIndex] = updatedRow
        return [...oldData]
      })
      await updateRowMutation({
        variables: {
          input: {
            tableId,
            rowId,
            data,
          },
        },
      })
    },
    [setData, tableId, updateRowMutation],
  )
  return {
    rowsUpdating,
    updateRow,
  }
}

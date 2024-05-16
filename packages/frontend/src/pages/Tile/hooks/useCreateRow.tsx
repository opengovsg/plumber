import { Dispatch, SetStateAction, useCallback, useState } from 'react'
import { useMutation } from '@apollo/client'
import { CREATE_ROW } from 'graphql/mutations/tiles/create-row'

import { NEW_ROW_ID, TEMP_ROW_ID_PREFIX } from '../constants'
import { useTableContext } from '../contexts/TableContext'
import { GenericRowData } from '../types'

interface CreateRowInput {
  input: {
    tableId: string
    data: Record<string, string>
  }
}

interface CreateRowOutput {
  createRow: string
}

export function useCreateRow(
  setData: Dispatch<SetStateAction<GenericRowData[]>>,
) {
  const { tableId } = useTableContext()
  const [rowsCreated, setRowsCreated] = useState<Set<string>>(new Set())

  const [createRowMutation] = useMutation<CreateRowOutput, CreateRowInput>(
    CREATE_ROW,
    {
      onCompleted({ createRow: createdRowId }) {
        setRowsCreated((prev) => new Set(prev.add(createdRowId)))
        setTimeout(() => {
          setRowsCreated((prev) => {
            prev.delete(createdRowId)
            return new Set(prev)
          })
        }, 1000)
      },
    },
  )

  const createRow = useCallback(
    async (newRow: GenericRowData) => {
      const { rowId: _, ...data } = newRow
      const tempRowId = TEMP_ROW_ID_PREFIX + crypto.randomUUID()
      setData((oldData) => {
        const newTempRow = {
          ...data,
          rowId: tempRowId,
        }
        if (oldData[oldData.length - 1]?.rowId === NEW_ROW_ID) {
          oldData.splice(-1, 0, newTempRow)
        } else {
          oldData.push(newTempRow)
        }
        return [...oldData]
      })
      const { data: mutationData } = await createRowMutation({
        variables: {
          input: {
            tableId,
            data,
          },
        },
      })
      if (mutationData?.createRow) {
        setData((oldData) => {
          const rowIndex = oldData.findIndex((row) => row.rowId === tempRowId)
          oldData[rowIndex] = {
            ...oldData[rowIndex],
            rowId: mutationData.createRow,
          }
          return [...oldData]
        })
      }
    },
    [createRowMutation, setData, tableId],
  )
  return {
    rowsCreated,
    createRow,
  }
}

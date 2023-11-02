import { ITableColumnMetadata } from '@plumber/types'

import { useCallback, useState } from 'react'
import { useMutation } from '@apollo/client'
import { UPDATE_TABLE } from 'graphql/mutations/update-table'
import { GET_TABLE } from 'graphql/queries/get-table'

import { useTableContext } from '../contexts/TableContext'

interface UpdateTableInput {
  input: {
    id: string
    name?: string
    modifiedColumns?: ITableColumnMetadata[]
    addedColumns?: string[]
    deletedColumns?: string[]
  }
}

interface UpdateTableOutput {
  createRow: string
}

export function useUpdateTable() {
  const { tableId } = useTableContext()
  const [isCreatingColumn, setIsCreatingColumn] = useState(false)
  const [isUpdatingColumn, setIsUpdatingColumn] = useState(false)

  const [updateTable] = useMutation<UpdateTableOutput, UpdateTableInput>(
    UPDATE_TABLE,
    {
      awaitRefetchQueries: true,
      refetchQueries: [GET_TABLE],
    },
  )

  const createColumn = useCallback(
    (newColumnName: string) => {
      setIsCreatingColumn(true)
      return updateTable({
        variables: {
          input: {
            id: tableId,
            addedColumns: [newColumnName],
          },
        },
        onCompleted: () => {
          setIsCreatingColumn(false)
        },
        onError: () => {
          setIsCreatingColumn(false)
        },
      })
    },
    [tableId, updateTable],
  )

  const updateColumn = useCallback(
    (columnId: string, newColumnName: string) => {
      setIsUpdatingColumn(true)
      return updateTable({
        variables: {
          input: {
            id: tableId,
            modifiedColumns: [
              {
                id: columnId,
                name: newColumnName,
              },
            ],
          },
        },
        onCompleted: () => {
          setIsUpdatingColumn(false)
        },
        onError: () => {
          setIsUpdatingColumn(false)
        },
      })
    },
    [tableId, updateTable],
  )

  return { createColumn, isCreatingColumn, updateColumn, isUpdatingColumn }
}

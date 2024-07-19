import { ITableColumnMetadata } from '@plumber/types'

import { useCallback, useState } from 'react'
import { useMutation } from '@apollo/client'
import { type SetOptional } from 'type-fest'

import { UPDATE_TABLE } from '@/graphql/mutations/tiles/update-table'
import { GET_TABLE } from '@/graphql/queries/tiles/get-table'

import { useTableContext } from '../contexts/TableContext'

interface UpdateTableInput {
  input: {
    id: string
    name?: string
    modifiedColumns?: SetOptional<
      ITableColumnMetadata,
      'name' | 'position' | 'config'
    >[]
    addedColumns?: string[]
    deletedColumns?: string[]
  }
}

interface UpdateTableOutput {
  createRow: string
}

export function useUpdateTable() {
  const { tableId } = useTableContext()
  const [isUpdatingTableName, setIsUpdatingTableName] = useState(false)
  const [isCreatingColumns, setIsCreatingColumns] = useState(false)
  const [isUpdatingColumns, setIsUpdatingColumns] = useState(false)
  const [isDeletingColumns, setIsDeletingColumns] = useState(false)

  const [updateTable] = useMutation<UpdateTableOutput, UpdateTableInput>(
    UPDATE_TABLE,
    {
      awaitRefetchQueries: true,
      refetchQueries: [GET_TABLE],
    },
  )

  const updateTableName = useCallback(
    (newName: string) => {
      setIsUpdatingTableName(true)
      return updateTable({
        variables: {
          input: {
            id: tableId,
            name: newName,
          },
        },
        onCompleted: () => {
          setIsUpdatingTableName(false)
        },
        onError: () => {
          setIsUpdatingTableName(false)
        },
      })
    },
    [tableId, updateTable],
  )

  const createColumns = useCallback(
    (newColumnNames: string[], shouldRefetchQueries = true) => {
      setIsCreatingColumns(true)
      return updateTable({
        variables: {
          input: {
            id: tableId,
            addedColumns: newColumnNames,
          },
        },
        onCompleted: () => {
          setIsCreatingColumns(false)
        },
        onError: () => {
          setIsCreatingColumns(false)
        },
        refetchQueries: shouldRefetchQueries ? undefined : [],
      })
    },
    [tableId, updateTable],
  )

  const updateColumns = useCallback(
    (modifiedColumns: UpdateTableInput['input']['modifiedColumns']) => {
      setIsUpdatingColumns(true)
      return updateTable({
        variables: {
          input: {
            id: tableId,
            modifiedColumns,
          },
        },
        onCompleted: () => {
          setIsUpdatingColumns(false)
        },
        onError: () => {
          setIsUpdatingColumns(false)
        },
      })
    },
    [tableId, updateTable],
  )

  const deleteColumns = useCallback(
    (deletedColumns: UpdateTableInput['input']['deletedColumns']) => {
      setIsUpdatingColumns(true)
      return updateTable({
        variables: {
          input: {
            id: tableId,
            deletedColumns,
          },
        },
        onCompleted: () => {
          setIsDeletingColumns(false)
        },
        onError: () => {
          setIsDeletingColumns(false)
        },
      })
    },
    [tableId, updateTable],
  )

  return {
    updateTableName,
    isUpdatingTableName,
    createColumns,
    isCreatingColumns,
    updateColumns,
    isUpdatingColumns,
    deleteColumns,
    isDeletingColumns,
  }
}

import { ITableColumnMetadata, ITableRow } from '@plumber/types'

import React, { createContext, useContext, useMemo } from 'react'

import { flattenRows } from '../helpers/flatten-rows'
import { GenericRowData } from '../types'

interface TableContextProps {
  tableId: string
  flattenedData: GenericRowData[]
  tableColumns: ITableColumnMetadata[]
}

const TableContext = createContext<TableContextProps | undefined>(undefined)

export const useTableContext = () => {
  const context = useContext(TableContext)
  if (!context) {
    throw new Error(
      'useTableContext must be used within a TableContextProvider',
    )
  }
  return context
}

interface TableContextProviderProps {
  tableId: string
  tableColumns: ITableColumnMetadata[]
  tableRows: ITableRow[]
  children: React.ReactNode
}

export const TableContextProvider = ({
  tableId,
  tableColumns,
  tableRows,
  children,
}: TableContextProviderProps) => {
  const flattenedData = useMemo(() => flattenRows(tableRows), [tableRows])

  return (
    <TableContext.Provider
      value={{
        tableId,
        flattenedData,
        tableColumns,
      }}
    >
      {children}
    </TableContext.Provider>
  )
}

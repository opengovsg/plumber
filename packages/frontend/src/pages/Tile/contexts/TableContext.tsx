import { ITableColumnMetadata, ITableRow } from '@plumber/types'

import React, {
  createContext,
  MutableRefObject,
  useContext,
  useMemo,
  useRef,
} from 'react'

import { flattenRows } from '../helpers/flatten-rows'
import { GenericRowData } from '../types'

interface TableContextProps {
  tableId: string
  tableName: string
  flattenedData: GenericRowData[]
  tableColumns: ITableColumnMetadata[]
  filteredDataRef: MutableRefObject<GenericRowData[]>
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
  tableName: string
  tableColumns: ITableColumnMetadata[]
  tableRows: ITableRow[]
  children: React.ReactNode
}

export const TableContextProvider = ({
  tableId,
  tableName,
  tableColumns,
  tableRows,
  children,
}: TableContextProviderProps) => {
  const flattenedData = useMemo(() => flattenRows(tableRows), [tableRows])
  const filteredDataRef = useRef<GenericRowData[]>([])
  return (
    <TableContext.Provider
      value={{
        tableId,
        tableName,
        flattenedData,
        tableColumns,
        filteredDataRef,
      }}
    >
      {children}
    </TableContext.Provider>
  )
}

import { ITableColumnMetadata, ITableRow } from '@plumber/types'

import React, {
  createContext,
  MutableRefObject,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'

import { flattenRows } from '../helpers/flatten-rows'
import { EditMode, GenericRowData } from '../types'

interface TableContextProps {
  tableId: string
  tableName: string
  flattenedData: GenericRowData[]
  tableColumns: ITableColumnMetadata[]
  filteredDataRef: MutableRefObject<GenericRowData[]>
  mode: EditMode
  setMode: (mode: EditMode) => void
  hasEditPermission: boolean
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
  hasEditPermission: boolean
}

export const TableContextProvider = ({
  tableId,
  tableName,
  tableColumns,
  tableRows,
  children,
  hasEditPermission,
}: TableContextProviderProps) => {
  const flattenedData = useMemo(() => flattenRows(tableRows), [tableRows])
  const filteredDataRef = useRef<GenericRowData[]>([])
  const [mode, setMode] = useState<EditMode>('view')
  return (
    <TableContext.Provider
      value={{
        tableId,
        tableName,
        flattenedData,
        tableColumns,
        filteredDataRef,
        mode,
        setMode,
        hasEditPermission,
      }}
    >
      {children}
    </TableContext.Provider>
  )
}

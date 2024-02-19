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
  allDataRef: MutableRefObject<GenericRowData[]>
  mode: EditMode
  setMode: (mode: EditMode) => void
  hasEditPermission: boolean
  viewOnlyKey?: string
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
  viewOnlyKey?: string
}

export const TableContextProvider = ({
  tableId,
  tableName,
  tableColumns,
  tableRows,
  children,
  hasEditPermission,
  viewOnlyKey,
}: TableContextProviderProps) => {
  const flattenedData = useMemo(() => flattenRows(tableRows), [tableRows])
  const filteredDataRef = useRef<GenericRowData[]>([])
  const allDataRef = useRef<GenericRowData[]>(flattenedData)
  const [mode, setMode] = useState<EditMode>(
    hasEditPermission ? 'edit' : 'view',
  )
  return (
    <TableContext.Provider
      value={{
        tableId,
        tableName,
        flattenedData,
        tableColumns,
        allDataRef,
        filteredDataRef,
        mode,
        setMode,
        hasEditPermission,
        viewOnlyKey,
      }}
    >
      {children}
    </TableContext.Provider>
  )
}

import { createContext, ReactNode, useCallback, useContext } from 'react'
import { TableMeta } from '@tanstack/react-table'

import styles from '../components/TableRow/TableCell.module.css'
import { TEMP_ROW_ID_PREFIX } from '../constants'
import { GenericRowData } from '../types'

interface RowContextProps {
  sortedIndex: number
  getClassName: (
    tableMeta: TableMeta<GenericRowData>,
    rowId: string,
  ) => string | undefined
}

const RowContext = createContext<RowContextProps | undefined>(undefined)

export const useRowContext = () => {
  const context = useContext(RowContext)
  if (!context) {
    throw new Error('useRowContext must be used within a RowContextProvider')
  }
  return context
}

interface RowContextProviderProps {
  sortedIndex?: number
  children: ReactNode
}

export const RowContextProvider = ({
  sortedIndex,
  children,
}: RowContextProviderProps) => {
  const getClassName = useCallback(
    (tableMeta: TableMeta<GenericRowData>, rowId: string) => {
      const isSavingRow = tableMeta?.rowsUpdating[rowId]
      const isSavedRow = tableMeta?.rowsCreated.has(rowId)
      if (isSavingRow === true) {
        return styles.saving
      }
      if (isSavingRow === false) {
        return styles.saved
      }
      if (rowId.startsWith(TEMP_ROW_ID_PREFIX)) {
        return styles.saving
      }
      if (isSavedRow) {
        return styles.saved
      }
      return undefined
    },
    [],
  )

  return (
    <RowContext.Provider
      value={{
        sortedIndex: sortedIndex ?? -1,
        getClassName,
      }}
    >
      {children}
    </RowContext.Provider>
  )
}

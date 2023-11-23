import { createContext, ReactNode, useContext } from 'react'

interface RowContextProps {
  sortedIndex: number
  className: string | undefined
  isHighlightingRow: boolean
  isEditingRow: boolean
  backgroundColor: string
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
  className: string | undefined
  isHighlightingRow: boolean
  isEditingRow: boolean
  backgroundColor: string
  children: ReactNode
}

export const RowContextProvider = ({
  sortedIndex,
  className,
  isHighlightingRow,
  isEditingRow,
  backgroundColor,
  children,
}: RowContextProviderProps) => {
  return (
    <RowContext.Provider
      value={{
        sortedIndex: sortedIndex ?? -1,
        className,
        isHighlightingRow,
        isEditingRow,
        backgroundColor,
      }}
    >
      {children}
    </RowContext.Provider>
  )
}

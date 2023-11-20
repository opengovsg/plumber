import { createContext, ReactNode, useContext } from 'react'

interface RowContextProps {
  sortedIndex: number
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
  return (
    <RowContext.Provider
      value={{
        sortedIndex: sortedIndex ?? -1,
      }}
    >
      {children}
    </RowContext.Provider>
  )
}

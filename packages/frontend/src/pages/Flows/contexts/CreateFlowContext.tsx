import { createContext, ReactNode, useContext, useState } from 'react'

interface CreateFlowContextProps {
  canUseAiBuilder: boolean
  createMode: FLOW_CREATE_MODE | null
  setCreateMode: (mode: FLOW_CREATE_MODE) => void
  skipModeSelection: boolean
  setSkipModeSelection: (skip: boolean) => void
}

export type FLOW_CREATE_MODE = 'ai' | 'new' | 'template'

const CreateFlowContext = createContext<CreateFlowContextProps | null>(null)

export const useCreateFlowContext = () => {
  const context = useContext(CreateFlowContext)
  if (!context) {
    throw new Error(
      'useCreateFlowContext must be used within a CreateFlowContextProvider',
    )
  }
  return context
}

export const CreateFlowContextProvider = ({
  createMode,
  setCreateMode,
  children,
}: {
  createMode: FLOW_CREATE_MODE | null
  setCreateMode: (mode: FLOW_CREATE_MODE) => void
  children: ReactNode
}) => {
  const [skipModeSelection, setSkipModeSelection] = useState<boolean>(false)

  return (
    <CreateFlowContext.Provider
      value={{
        // AI Builder is available to every user.
        canUseAiBuilder: true,
        createMode,
        setCreateMode,
        skipModeSelection,
        setSkipModeSelection,
      }}
    >
      {children}
    </CreateFlowContext.Provider>
  )
}

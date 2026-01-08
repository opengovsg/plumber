import { createContext, ReactNode, useContext, useState } from 'react'

import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'

interface CreateFlowContextProps {
  canUseAiBuilder: boolean
  aiBuilderType: string
  createMode: FLOW_CREATE_MODE | null
  setCreateMode: (mode: FLOW_CREATE_MODE) => void
  skipModeSelection: boolean
  setSkipModeSelection: (skip: boolean) => void
}

export type FLOW_CREATE_MODE = 'ai-chat' | 'ai-form' | 'new' | 'template'

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
  // TODO (kevinkim-ogp): remove the flag value once GA
  const { getFlagValue } = useContext(LaunchDarklyContext)
  const aiBuilderType = getFlagValue('ai-builder-type', 'none')
  const canUseAiBuilder = aiBuilderType !== 'none'

  const [skipModeSelection, setSkipModeSelection] = useState<boolean>(false)

  return (
    <CreateFlowContext.Provider
      value={{
        aiBuilderType,
        canUseAiBuilder,
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

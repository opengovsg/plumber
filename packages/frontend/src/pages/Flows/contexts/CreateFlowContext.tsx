import { createContext, ReactNode, useContext, useState } from 'react'

import { AI_BUILDER_FEATURE_FLAG } from '@/config/flags'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'

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
  // TODO (kevinkim-ogp): remove the flag value once GA
  const { getFlagValue } = useContext(LaunchDarklyContext)
  const aiBuilderFlag = getFlagValue(AI_BUILDER_FEATURE_FLAG, {
    enabled: false,
  })
  const canUseAiBuilder = aiBuilderFlag.enabled

  const [skipModeSelection, setSkipModeSelection] = useState<boolean>(false)

  return (
    <CreateFlowContext.Provider
      value={{
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

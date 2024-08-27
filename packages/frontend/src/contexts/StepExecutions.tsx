import type { IExecutionStep } from '@plumber/types'

import * as React from 'react'

export const StepExecutionsContext = React.createContext<{
  priorExecutionSteps: IExecutionStep[]
}>({ priorExecutionSteps: [] })

type StepExecutionsProviderProps = {
  children: React.ReactNode
  priorExecutionSteps: IExecutionStep[]
}

export const StepExecutionsProvider = (
  props: StepExecutionsProviderProps,
): React.ReactElement => {
  const { children, priorExecutionSteps } = props
  return (
    <StepExecutionsContext.Provider value={{ priorExecutionSteps }}>
      {children}
    </StepExecutionsContext.Provider>
  )
}

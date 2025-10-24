import type { IStep } from '@plumber/types'

import type { ReactNode } from 'react'
import { createContext } from 'react'

export type StepExecutionsToIncludeContextData = {
  triggerStep: IStep | null
  actionStepsBeforeGroup: IStep[]
  groupedSteps: IStep[][]
}

export const StepExecutionsToIncludeContext =
  createContext<StepExecutionsToIncludeContextData>({
    triggerStep: null,
    actionStepsBeforeGroup: [],
    groupedSteps: [],
  })

interface StepExecutionsProviderProps {
  children: ReactNode
  triggerStep: IStep | null
  actionStepsBeforeGroup: IStep[]
  groupedSteps: IStep[][]
}

export function StepExecutionsToIncludeProvider({
  children,
  triggerStep,
  actionStepsBeforeGroup,
  groupedSteps,
}: StepExecutionsProviderProps): JSX.Element {
  return (
    <StepExecutionsToIncludeContext.Provider
      value={{
        triggerStep,
        actionStepsBeforeGroup,
        groupedSteps,
      }}
    >
      {children}
    </StepExecutionsToIncludeContext.Provider>
  )
}

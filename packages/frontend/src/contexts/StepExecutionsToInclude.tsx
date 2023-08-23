import type { IStep } from '@plumber/types'

import type { ReactNode } from 'react'
import { createContext } from 'react'

export type StepExecutionsToIncludeContextData = ReadonlySet<IStep['id']>

export const StepExecutionsToIncludeContext =
  createContext<StepExecutionsToIncludeContextData>(new Set())

type StepExecutionsProviderProps = {
  children: ReactNode
  value: StepExecutionsToIncludeContextData
}

export function StepExecutionsToIncludeProvider(
  props: StepExecutionsProviderProps,
): JSX.Element {
  const { children, value } = props
  return (
    <StepExecutionsToIncludeContext.Provider value={value}>
      {children}
    </StepExecutionsToIncludeContext.Provider>
  )
}

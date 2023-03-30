import type { IStep } from '@plumber/types'

import * as React from 'react'

export const StepExecutionsContext = React.createContext<IStep[]>([])

type StepExecutionsProviderProps = {
  children: React.ReactNode
  value: IStep[]
}

export const StepExecutionsProvider = (
  props: StepExecutionsProviderProps,
): React.ReactElement => {
  const { children, value } = props
  return (
    <StepExecutionsContext.Provider value={value}>
      {children}
    </StepExecutionsContext.Provider>
  )
}

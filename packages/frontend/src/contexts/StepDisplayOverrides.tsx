import type { IStep } from '@plumber/types'

import type { ReactNode } from 'react'
import { createContext } from 'react'

//
// FIXME (ogp-weeloong): This is hella hackfix... think of something better and
// refactor.
//

interface StepDisplayOverrides {
  hintAboveCaption?: string
  caption?: string
  disableActionChanges?: boolean
  disableDelete?: boolean
}

// Using record instead of Map because most of the time we will only have 1-2 overrides.
export type StepDisplayOverridesContextData = Record<
  IStep['id'],
  StepDisplayOverrides
>

export const StepDisplayOverridesContext =
  createContext<StepDisplayOverridesContextData>({})

type StepExecutionsProviderProps = {
  children: ReactNode
  value: StepDisplayOverridesContextData
}

export function StepDisplayOverridesProvider(
  props: StepExecutionsProviderProps,
): JSX.Element {
  const { children, value } = props
  return (
    <StepDisplayOverridesContext.Provider value={value}>
      {children}
    </StepDisplayOverridesContext.Provider>
  )
}

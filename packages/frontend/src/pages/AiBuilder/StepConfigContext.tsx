import type { IJSONObject } from '@plumber/types'

import { createContext, useContext } from 'react'

interface StepConfigContextValue {
  activeStepId: string | null
  stepParametersByStepId: Record<string, IJSONObject>
  completedStepIds: Set<string>
}

const StepConfigContext = createContext<StepConfigContextValue>({
  activeStepId: null,
  stepParametersByStepId: {},
  completedStepIds: new Set(),
})

export const useStepConfigContext = () => useContext(StepConfigContext)

export default StepConfigContext

import type { IJSONObject } from '@plumber/types'

import { createContext, useContext } from 'react'

interface StepConfigContextValue {
  stepParametersByStepId: Record<string, IJSONObject>
  parameterLabelsByStepId: Record<string, Record<string, string>>
  completedStepIds: Set<string>
  activeStepId: string | null
}

const StepConfigContext = createContext<StepConfigContextValue>({
  stepParametersByStepId: {},
  parameterLabelsByStepId: {},
  completedStepIds: new Set(),
  activeStepId: null,
})

export const useStepConfigContext = () => useContext(StepConfigContext)

export default StepConfigContext

import type { IJSONObject } from '@plumber/types'

import { createContext, useContext } from 'react'

interface StepConfigContextValue {
  stepParametersByStepId: Record<string, IJSONObject>
  parameterLabelsByStepId: Record<string, Record<string, string>>
  completedStepIds: Set<string>
}

const StepConfigContext = createContext<StepConfigContextValue>({
  stepParametersByStepId: {},
  parameterLabelsByStepId: {},
  completedStepIds: new Set(),
})

export const useStepConfigContext = () => useContext(StepConfigContext)

export default StepConfigContext

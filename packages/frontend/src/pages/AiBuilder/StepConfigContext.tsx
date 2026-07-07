import type { IJSONObject } from '@plumber/types'

import { createContext, useContext } from 'react'

interface StepConfigContextValue {
  activeStepId: string | null
  stepParametersByStepId: Record<string, IJSONObject>
}

const StepConfigContext = createContext<StepConfigContextValue>({
  activeStepId: null,
  stepParametersByStepId: {},
})

export const useStepConfigContext = () => useContext(StepConfigContext)

export default StepConfigContext

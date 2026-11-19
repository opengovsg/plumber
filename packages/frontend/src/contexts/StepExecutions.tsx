import type { IExecutionStep, IStep } from '@plumber/types'
import { createContext, useContext, useMemo } from 'react'

import { getEligibleVariableStepIds } from '@/components/Editor/helpers/steps-utils'

import { EditorContext } from './Editor'
import { StepsToDisplayContext } from './StepsToDisplay'

export const StepExecutionsContext = createContext<{
  priorExecutionSteps: IExecutionStep[]
}>({ priorExecutionSteps: [] })

type StepExecutionsProviderProps = {
  children: React.ReactNode
  currentStep: IStep
}

export const StepExecutionsProvider = ({
  currentStep,
  children,
}: StepExecutionsProviderProps): React.ReactElement => {
  const { testExecutionSteps } = useContext(EditorContext)

  const { triggerStep, actionStepsToDisplay, groupingActions } = useContext(
    StepsToDisplayContext,
  )

  const stepExecutionsToInclude = useMemo(
    () =>
      new Set([
        ...(triggerStep?.id ? [triggerStep.id] : []),
        ...getEligibleVariableStepIds(
          actionStepsToDisplay,
          groupingActions ?? new Set<string>(),
          currentStep.id,
        ),
      ]),
    [triggerStep, actionStepsToDisplay, groupingActions, currentStep.id],
  )

  const priorExecutionSteps = useMemo(
    () =>
      testExecutionSteps.filter(
        (stepExecution) =>
          stepExecutionsToInclude.has(stepExecution.stepId) &&
          stepExecution.step.position < currentStep.position,
      ),
    [currentStep.position, stepExecutionsToInclude, testExecutionSteps],
  )

  return (
    <StepExecutionsContext.Provider value={{ priorExecutionSteps }}>
      {children}
    </StepExecutionsContext.Provider>
  )
}

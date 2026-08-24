import type { IExecutionStep, IStep } from '@plumber/types'
import { createContext, useContext, useMemo } from 'react'

import { TOOLBOX_ACTIONS } from '@/helpers/toolbox'

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

  const {
    triggerStep,
    actionStepsBeforeGroup: stepsBeforeGroup,
    groupedSteps,
  } = useContext(StepsToDisplayContext)

  //
  // Compute which steps are eligible for variable extraction.
  // Mainly for if-then branches where we do not want to include steps
  // from other branches.
  //
  // Note:
  // - we include some grouped steps as there is no longer a nested editor
  // - we identify the group by checking if the current step id is in the group
  // - for-each steps are always included
  const groupStepsToInclude = useMemo(() => {
    return groupedSteps.flatMap((group) =>
      group.some(
        (step) =>
          step.key === TOOLBOX_ACTIONS.ForEach || step.id === currentStep.id,
      )
        ? group
        : [],
    )
  }, [currentStep?.id, groupedSteps])

  const stepExecutionsToInclude = useMemo(
    () =>
      new Set([
        ...(triggerStep?.id ? [triggerStep.id] : []),
        ...stepsBeforeGroup.map((step) => step.id),
        ...groupStepsToInclude.map((s) => s.id),
      ]),
    [triggerStep, stepsBeforeGroup, groupStepsToInclude],
  )

  const priorExecutionSteps = useMemo(
    () =>
      testExecutionSteps.filter(
        (stepExecution) =>
          stepExecutionsToInclude?.has(stepExecution.stepId) &&
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

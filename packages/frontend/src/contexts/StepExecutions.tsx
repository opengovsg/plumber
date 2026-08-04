import type { IExecutionStep, IStep } from '@plumber/types'

import { createContext, useContext, useMemo } from 'react'

import { getEligibleVariableStepIds } from '@/components/Editor/helpers/steps-utils'
import { TOOLBOX_ACTIONS } from '@/helpers/toolbox'
import { useIfThenV2Enabled } from '@/hooks/useIfThenV2Enabled'

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
    actionStepsToDisplay,
    groupingActions,
  } = useContext(StepsToDisplayContext)

  const { isEnabled: isIfThenV2Enabled, isLoading: isIfThenV2Loading } =
    useIfThenV2Enabled()

  //
  // Compute which steps are eligible for variable extraction.
  // Mainly for if-then branches where we do not want to include steps
  // from other branches.
  //
  // Note:
  // - we include some grouped steps as there is no longer a nested editor
  // - we identify the group by checking if the current step id is in the group
  // - for-each steps are always included
  //
  // If-then V1 only. Left untouched because the if-then V2-aware fork below
  // is additive.
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

  const eligibleBlockStepIds = useMemo(
    () =>
      getEligibleVariableStepIds(
        actionStepsToDisplay,
        groupingActions ?? new Set<string>(),
        currentStep.id,
      ),
    [actionStepsToDisplay, groupingActions, currentStep.id],
  )

  const stepExecutionsToInclude = useMemo(() => {
    if (isIfThenV2Enabled && !isIfThenV2Loading) {
      return new Set([
        ...(triggerStep?.id ? [triggerStep.id] : []),
        ...eligibleBlockStepIds,
      ])
    }
    return new Set([
      ...(triggerStep?.id ? [triggerStep.id] : []),
      ...stepsBeforeGroup.map((step) => step.id),
      ...groupStepsToInclude.map((s) => s.id),
    ])
  }, [
    isIfThenV2Enabled,
    isIfThenV2Loading,
    eligibleBlockStepIds,
    triggerStep,
    stepsBeforeGroup,
    groupStepsToInclude,
  ])

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

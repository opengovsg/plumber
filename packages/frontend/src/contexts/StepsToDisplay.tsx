import type { IApp, IStep } from '@plumber/types'
import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useMemo } from 'react'

import { filterStepsByApprovalBranch } from '@/helpers/formsg'

import { EditorContext } from './Editor'
import { MrfContext } from './MrfContext'

export type StepToDisplayContextValue = {
  triggerStep: IStep | null
  appsWithActions: IApp[]
  groupingActions: Set<string> | null
  stepIdToOrder: Record<string, number>
  // The MRF-filtered steps to display with the trigger dropped.
  actionStepsToDisplay: IStep[]
}

export const StepsToDisplayContext = createContext<StepToDisplayContextValue>({
  triggerStep: null,
  appsWithActions: [],
  groupingActions: null,
  stepIdToOrder: {},
  actionStepsToDisplay: [],
})

interface StepExecutionsProviderProps {
  children: ReactNode
}

export function StepsToDisplayProvider({
  children,
}: StepExecutionsProviderProps): JSX.Element {
  const { allApps, flow, currentStepId, setCurrentStepId, onDrawerClose } =
    useContext(EditorContext)
  const { approvalBranches } = useContext(MrfContext)

  const allSteps = flow.steps

  const stepsToDisplay = useMemo(
    () => filterStepsByApprovalBranch(allSteps, approvalBranches),
    [allSteps, approvalBranches],
  )

  // The trigger is always first in the MRF-filtered list, so slice(1) drops
  // it.
  const actionStepsToDisplay = useMemo(
    () => stepsToDisplay.slice(1),
    [stepsToDisplay],
  )

  const appsWithActions: IApp[] = allApps.filter(
    (app: IApp) => !!app.actions?.length,
  )

  const groupingActions = useMemo(() => {
    if (!appsWithActions) {
      return null
    }

    return new Set(
      appsWithActions?.flatMap((app) =>
        app.actions
          ?.filter((action) => action.groupsLaterSteps)
          ?.map((action) => `${app.key}-${action.key}`),
      ) ?? [],
    ) as Set<string>
  }, [appsWithActions])

  const stepIdToOrder = useMemo(() => {
    const map: Record<string, number> = {}
    stepsToDisplay.forEach((step, index) => {
      map[step.id] = index + 1
    })
    return map
  }, [stepsToDisplay])

  const triggerStep = groupingActions ? stepsToDisplay[0] : null

  useEffect(() => {
    if (
      currentStepId &&
      !stepsToDisplay.map((step) => step.id).includes(currentStepId)
    ) {
      setCurrentStepId(null)
      onDrawerClose()
    }
  }, [stepsToDisplay, currentStepId, onDrawerClose, setCurrentStepId])

  return (
    <StepsToDisplayContext.Provider
      value={{
        triggerStep,
        appsWithActions,
        groupingActions,
        stepIdToOrder,
        actionStepsToDisplay,
      }}
    >
      {children}
    </StepsToDisplayContext.Provider>
  )
}

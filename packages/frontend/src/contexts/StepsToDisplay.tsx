import type { IApp, IStep } from '@plumber/types'

import type { ReactNode } from 'react'
import { createContext, useContext, useMemo } from 'react'

import { extractBranchesWithSteps } from '@/helpers/toolbox'

import { EditorContext } from './Editor'
import { MrfContext } from './MrfContext'

export type StepToDisplayContextValue = {
  triggerStep: IStep | null
  actionStepsBeforeGroup: IStep[]
  groupedSteps: IStep[][]
  appsWithActions: IApp[]
  groupingActions: Set<string> | null
}

export const StepsToDisplayContext = createContext<StepToDisplayContextValue>({
  triggerStep: null,
  actionStepsBeforeGroup: [],
  groupedSteps: [],
  appsWithActions: [],
  groupingActions: null,
})

interface StepExecutionsProviderProps {
  children: ReactNode
}

export function StepsToDisplayProvider({
  children,
}: StepExecutionsProviderProps): JSX.Element {
  const { allApps, flow } = useContext(EditorContext)
  const { approvalBranches } = useContext(MrfContext)

  const allSteps = flow.steps

  const stepsToDisplay = useMemo(() => {
    let firstRejectBranchStepId: string | null = null
    return allSteps.filter((step) => {
      if (
        firstRejectBranchStepId != null &&
        step.config?.approval?.stepId !== firstRejectBranchStepId
      ) {
        return false
      }

      if (!firstRejectBranchStepId && approvalBranches[step.id] === 'reject') {
        firstRejectBranchStepId = step.id
        return true
      }

      if (!step.config?.approval) {
        return true
      }

      const approvalConfigStepId = step.config?.approval?.stepId
      const approvalConfigBranch = step.config?.approval?.branch

      if (approvalBranches[approvalConfigStepId] === approvalConfigBranch) {
        return true
      }
      return false
    })
  }, [allSteps, approvalBranches])

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

  const [triggerStep, actionStepsBeforeGroup, groupedSteps] = useMemo(() => {
    if (!groupingActions) {
      return [null, [], []]
    }

    const groupStepIdx = stepsToDisplay.findIndex((step, index) => {
      if (
        // We ignore the 1st step because it's either a trigger, or a
        // step-grouping action that is using a nested Editor to edit steps in
        // its group.
        index === 0 ||
        !step.appKey ||
        !step.key
      ) {
        return false
      }
      return groupingActions.has(`${step.appKey}-${step.key}`)
    })

    let branchesWithSteps: IStep[][] = []
    if (groupStepIdx !== -1) {
      branchesWithSteps = extractBranchesWithSteps(
        stepsToDisplay.slice(groupStepIdx),
        0,
      )
    }

    const triggerStep = stepsToDisplay[0]

    return groupStepIdx === -1
      ? [triggerStep, stepsToDisplay.slice(1), []]
      : [triggerStep, stepsToDisplay.slice(1, groupStepIdx), branchesWithSteps]
  }, [groupingActions, stepsToDisplay])

  return (
    <StepsToDisplayContext.Provider
      value={{
        triggerStep,
        actionStepsBeforeGroup,
        groupedSteps,
        appsWithActions,
        groupingActions,
      }}
    >
      {children}
    </StepsToDisplayContext.Provider>
  )
}

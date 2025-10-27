import type { IApp, IStep } from '@plumber/types'

import type { ReactNode } from 'react'
import { createContext, useContext, useMemo } from 'react'

import { extractBranchesWithSteps } from '@/helpers/toolbox'

import { EditorContext } from './Editor'

export type StepExecutionsToIncludeContextData = {
  triggerStep: IStep | null
  actionStepsBeforeGroup: IStep[]
  groupedSteps: IStep[][]
  appsWithActions: IApp[]
  groupingActions: Set<string> | null
}

export const StepExecutionsToIncludeContext =
  createContext<StepExecutionsToIncludeContextData>({
    triggerStep: null,
    actionStepsBeforeGroup: [],
    groupedSteps: [],
    appsWithActions: [],
    groupingActions: null,
  })

interface StepExecutionsProviderProps {
  children: ReactNode
}

export function StepExecutionsToIncludeProvider({
  children,
}: StepExecutionsProviderProps): JSX.Element {
  const { allApps, flow } = useContext(EditorContext)

  const steps = flow.steps

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

    const groupStepIdx = steps.findIndex((step, index) => {
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
      branchesWithSteps = extractBranchesWithSteps(steps.slice(groupStepIdx), 0)
    }

    const triggerStep = steps[0]

    return groupStepIdx === -1
      ? [triggerStep, steps.slice(1), []]
      : [triggerStep, steps.slice(1, groupStepIdx), branchesWithSteps]
  }, [groupingActions, steps])

  return (
    <StepExecutionsToIncludeContext.Provider
      value={{
        triggerStep,
        actionStepsBeforeGroup,
        groupedSteps,
        appsWithActions,
        groupingActions,
      }}
    >
      {children}
    </StepExecutionsToIncludeContext.Provider>
  )
}

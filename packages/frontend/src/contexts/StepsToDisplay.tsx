import type { IApp, IStep } from '@plumber/types'

import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useMemo } from 'react'

import {
  buildRegionList,
  extractBranchesWithSteps,
  type StepRegion,
} from '@/helpers/toolbox'

import { EditorContext } from './Editor'
import { MrfContext } from './MrfContext'

export type StepToDisplayContextValue = {
  triggerStep: IStep | null
  actionStepsBeforeGroup: IStep[]
  groupedSteps: IStep[][]
  regionList: StepRegion[]
  appsWithActions: IApp[]
  groupingActions: Set<string> | null
  stepIdToOrder: Record<string, number>
}

export const StepsToDisplayContext = createContext<StepToDisplayContextValue>({
  triggerStep: null,
  actionStepsBeforeGroup: [],
  groupedSteps: [],
  regionList: [],
  appsWithActions: [],
  groupingActions: null,
  stepIdToOrder: {},
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

  const stepIdToOrder = useMemo(() => {
    const map: Record<string, number> = {}
    stepsToDisplay.forEach((step, index) => {
      map[step.id] = index + 1
    })
    return map
  }, [stepsToDisplay])

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

  const regionList = useMemo(() => {
    if (!groupingActions) {
      return []
    }
    // Region list covers the steps after the trigger.
    return buildRegionList(stepsToDisplay.slice(1), groupingActions)
  }, [groupingActions, stepsToDisplay])

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
        actionStepsBeforeGroup,
        groupedSteps,
        regionList,
        appsWithActions,
        groupingActions,
        stepIdToOrder,
      }}
    >
      {children}
    </StepsToDisplayContext.Provider>
  )
}

import { IApp, type IStep } from '@plumber/types'

export const TOOLBOX_APP_KEY = 'toolbox'

export enum TOOLBOX_ACTIONS {
  IfThen = 'ifThen',
  ForEach = 'forEach',
}

//
// General toolbox helpers
//
export function getGroupingActions(appsWithActions: IApp[]) {
  if (!appsWithActions) {
    return null
  }

  return new Set(
    appsWithActions?.flatMap((app) =>
      app.actions
        ?.filter((action) => action.groupsLaterSteps)
        ?.map((action) => `${app.key}-${action.key}`),
    ) ?? [],
  )
}

export function getStepGroupTypeAndCaption(groupedSteps: IStep[][]): {
  stepGroupType: string | null
  stepGroupCaption: string | null
} {
  let stepGroupType: string | null = null
  let stepGroupCaption: string | null = null

  const groupKey = groupedSteps[0]?.[0]?.key
  if (!groupKey) {
    return { stepGroupType: null, stepGroupCaption: null }
  }

  if (groupKey === TOOLBOX_ACTIONS.IfThen) {
    stepGroupType = TOOLBOX_ACTIONS.IfThen
    stepGroupCaption = 'If-then'
  }

  if (groupKey === TOOLBOX_ACTIONS.ForEach) {
    stepGroupType = TOOLBOX_ACTIONS.ForEach
    stepGroupCaption = 'For each'
  }

  return { stepGroupType, stepGroupCaption }
}

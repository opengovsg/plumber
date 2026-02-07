import { IAction, IApp, IStep, ITrigger } from '@plumber/types'

import {
  isForEachStep as checkForEachStep,
  isIfThenStep as checkIfThenStep,
} from '@/helpers/toolbox'

export default function getStepName(allApps: IApp[], step: IStep | undefined) {
  if (!step) {
    return {
      stepName: '',
      defaultStepName: '',
    }
  }

  const {
    appKey,
    key,
    config: { stepName: customStepName = undefined } = {},
    type,
  } = step

  const isTrigger = type === 'trigger'
  const isIfThen = checkIfThenStep(step)
  const isForEach = checkForEachStep(step)

  const apps: IApp[] = allApps?.filter((app: IApp) =>
    isTrigger ? !!app.triggers?.length : !!app.actions?.length,
  )
  const app = apps?.find((currentApp: IApp) => currentApp.key === appKey)

  const actionsOrTriggers: Array<ITrigger | IAction> =
    (isTrigger ? app?.triggers : app?.actions) || []

  const selectedActionOrTrigger = actionsOrTriggers.find(
    (actionOrTrigger: IAction | ITrigger) => actionOrTrigger.key === key,
  )

  let stepName = ''
  let defaultStepName = selectedActionOrTrigger?.name

  if (isIfThen) {
    defaultStepName = 'Condition'
    stepName = customStepName ?? 'Condition'
    return {
      stepName,
      defaultStepName,
    }
  }

  if (isForEach) {
    stepName = customStepName ?? 'For each item'
    return {
      stepName,
      defaultStepName,
    }
  }

  if (customStepName) {
    stepName = customStepName
  } else if (defaultStepName) {
    stepName = defaultStepName
  } else if (app?.name) {
    stepName = app.name
  } else if (isTrigger) {
    stepName = 'This step starts your pipe'
  }

  return {
    stepName:
      stepName ||
      (appKey ? appKey.charAt(0).toUpperCase() + appKey.slice(1) : ''),
    defaultStepName,
  }
}

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

  const { appKey, key, config: { stepName: customStepName } = {}, type } = step

  // IfThen and ForEach are toolbox steps that don't need app lookup
  if (checkIfThenStep(step)) {
    return {
      stepName: customStepName ?? 'Condition',
      defaultStepName: 'Condition',
    }
  }

  if (checkForEachStep(step)) {
    return {
      stepName: customStepName ?? 'For each item',
      defaultStepName: 'For each item',
    }
  }

  const isTrigger = type === 'trigger'

  const apps: IApp[] = allApps?.filter((app: IApp) =>
    isTrigger ? !!app.triggers?.length : !!app.actions?.length,
  )
  const app = apps?.find((currentApp: IApp) => currentApp.key === appKey)

  const actionsOrTriggers: Array<ITrigger | IAction> =
    (isTrigger ? app?.triggers : app?.actions) || []

  const selectedActionOrTrigger = actionsOrTriggers.find(
    (actionOrTrigger: IAction | ITrigger) => actionOrTrigger.key === key,
  )

  const defaultStepName = selectedActionOrTrigger?.name

  const stepName =
    customStepName ||
    defaultStepName ||
    app?.name ||
    (isTrigger ? 'This step starts your pipe' : undefined) ||
    (appKey ? appKey.charAt(0).toUpperCase() + appKey.slice(1) : '')

  return {
    stepName,
    defaultStepName,
  }
}

import { IAction, IApp, IStep, ITrigger } from '@plumber/types'

import {
  isForEachStep as checkForEachStep,
  isIfThenStep as checkIfThenStep,
} from '@/helpers/toolbox'

export default function getStepName(allApps: IApp[], step: IStep | undefined) {
  if (!step) {
    return {
      caption: '',
      defaultCaption: '',
    }
  }

  const {
    appKey,
    key,
    config: { stepName = undefined } = {},
    position,
    type,
  } = step

  const isTrigger = type === 'trigger'
  const isIfThen = step ? checkIfThenStep(step) : false
  const isForEach = step ? checkForEachStep(step) : false

  const apps: IApp[] = allApps?.filter((app: IApp) =>
    isTrigger ? !!app.triggers?.length : !!app.actions?.length,
  )
  const app = apps?.find((currentApp: IApp) => currentApp.key === appKey)

  const actionsOrTriggers: Array<ITrigger | IAction> =
    (isTrigger ? app?.triggers : app?.actions) || []

  const selectedActionOrTrigger = actionsOrTriggers.find(
    (actionOrTrigger: IAction | ITrigger) => actionOrTrigger.key === key,
  )

  let caption = ''
  let defaultCaption = selectedActionOrTrigger?.name

  if (isIfThen) {
    defaultCaption = 'Condition'
    caption = stepName ? `${position}. ${stepName}` : `${position}. Condition`
    return {
      caption,
      defaultCaption,
    }
  }

  if (isForEach) {
    caption = stepName
      ? `${position}. ${stepName}`
      : `${position}. For each item`
    return {
      caption,
      defaultCaption,
    }
  }

  if (stepName) {
    caption = `${position}. ${stepName}`
  } else if (defaultCaption) {
    caption = `${position ? `${position}. ` : ''}${defaultCaption}`
  } else if (app?.name) {
    caption = `${position ? `${position}. ` : ''}${app.name}`
  } else if (isTrigger) {
    caption = 'This step starts your pipe'
  }

  return {
    caption:
      caption ||
      (appKey
        ? `${position}. ${appKey.charAt(0).toUpperCase() + appKey.slice(1)}`
        : ''),
    defaultCaption,
  }
}

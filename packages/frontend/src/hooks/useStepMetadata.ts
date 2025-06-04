import { IAction, IApp, IStep, ISubstep, ITrigger } from '@plumber/types'

import { useMemo } from 'react'

import {
  isForEachStep as checkForEachStep,
  isIfThenStep as checkIfThenStep,
} from '@/helpers/toolbox'

interface UseStepMetadataResult {
  app: IApp | undefined
  selectedActionOrTrigger: IAction | ITrigger | undefined
  caption: string
  defaultCaption?: string
  hasConnection: boolean
  isCompleted: boolean
  isIfThenStep: boolean
  isTrigger: boolean
  position: number
  stepName: string
  substeps: ISubstep[]
}

export function useStepMetadata(
  allApps: IApp[],
  step: IStep | undefined,
): UseStepMetadataResult {
  const isCompleted = step?.status === 'completed'
  const isTrigger = step?.type === 'trigger'
  const isIfThenStep = step ? checkIfThenStep(step) : false
  const isForEachStep = step ? checkForEachStep(step) : false

  const apps: IApp[] = allApps?.filter((app: IApp) =>
    isTrigger ? !!app.triggers?.length : !!app.actions?.length,
  )
  const app = apps?.find((currentApp: IApp) => currentApp.key === step?.appKey)

  const actionsOrTriggers: Array<ITrigger | IAction> = useMemo(
    () => (isTrigger ? app?.triggers : app?.actions) || [],
    [app?.actions, app?.triggers, isTrigger],
  )

  const selectedActionOrTrigger = useMemo(
    () =>
      actionsOrTriggers.find(
        (actionOrTrigger: IAction | ITrigger) =>
          actionOrTrigger.key === step?.key,
      ),
    [actionsOrTriggers, step?.key],
  )

  // define caption description based on app and step
  let caption = ''
  let defaultCaption = selectedActionOrTrigger?.name
  if (step?.config?.stepName) {
    caption = `${step.position}. ${step.config.stepName}`
  } else if (defaultCaption) {
    caption = `${step?.position ? `${step.position}. ` : ''}${defaultCaption}`

    if (isIfThenStep) {
      caption = `${step?.position}. Condition`
    }
    if (isForEachStep) {
      caption = `${step?.position}. For each item`
    }
  } else if (app?.name) {
    caption = `${step?.position ? `${step.position}. ` : ''}${app.name}`
  } else if (isTrigger) {
    caption = 'This step starts your pipe'
  } else if (step?.position === 2) {
    caption = 'This step happens after your pipe starts'
  } else {
    caption = 'This step happens after the previous step'
  }

  if (isIfThenStep) {
    defaultCaption = 'Condition'
  }

  const substeps = selectedActionOrTrigger?.substeps || []
  const hasConnection = substeps?.some(
    (substep: ISubstep) => substep.key === 'chooseConnection',
  )

  return {
    app,
    selectedActionOrTrigger,
    caption,
    defaultCaption,
    hasConnection,
    isCompleted,
    isIfThenStep,
    isTrigger,
    position: step?.position ?? 0,
    stepName: step?.config?.stepName
      ? step.config.stepName
      : defaultCaption ?? '',
    substeps,
  }
}

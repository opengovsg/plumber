import { IAction, IApp, IStep, ISubstep, ITrigger } from '@plumber/types'

import { useMemo } from 'react'

interface UseStepMetadataResult {
  app: IApp | undefined
  selectedActionOrTrigger: IAction | ITrigger | undefined
  caption: string
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
  const isIfThenStep = step?.appKey === 'toolbox' && step?.key === 'ifThen'

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
  if (step?.config?.stepName) {
    caption = `${step.position}. ${step.config.stepName}`
  } else if (selectedActionOrTrigger?.name) {
    caption = `${step?.position ? `${step.position}. ` : ''}${
      selectedActionOrTrigger?.name
    }`

    if (selectedActionOrTrigger.key === 'ifThen') {
      caption = `${step?.position ? `${step.position}. ` : ''} Condition`
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

  const substeps = useMemo(
    () => selectedActionOrTrigger?.substeps || [],
    [selectedActionOrTrigger],
  )

  return {
    app,
    selectedActionOrTrigger,
    caption,
    isCompleted,
    isIfThenStep,
    isTrigger,
    position: step?.position ?? 0,
    stepName: step?.config?.stepName ?? selectedActionOrTrigger?.name ?? '',
    substeps,
  }
}

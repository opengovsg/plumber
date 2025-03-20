import { IAction, IApp, IStep, ISubstep, ITrigger } from '@plumber/types'

import { useMemo } from 'react'
import { useQuery } from '@apollo/client'

import { GET_APPS } from '@/graphql/queries/get-apps'

interface UseStepMetadataResult {
  app: IApp | undefined
  apps: IApp[]
  selectedActionOrTrigger: IAction | ITrigger | undefined
  caption: string
  isTrigger: boolean
  substeps: ISubstep[]
}

export function useStepMetadata(
  step: IStep | undefined,
): UseStepMetadataResult {
  const { data } = useQuery(GET_APPS)
  const isTrigger = useMemo(() => step?.type === 'trigger', [step])

  const apps: IApp[] = data?.getApps?.filter((app: IApp) =>
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
  if (selectedActionOrTrigger?.name) {
    caption = `${step?.position ? `${step.position}. ` : ''}${
      selectedActionOrTrigger?.name
    }`
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
    apps,
    selectedActionOrTrigger,
    caption,
    isTrigger,
    substeps,
  }
}

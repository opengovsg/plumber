import { IAction, IApp, IStep, ISubstep, ITrigger } from '@plumber/types'

import { useMemo } from 'react'

import getStepName from '@/helpers/getStepName'
import { isIfThenStep as checkIfThenStep } from '@/helpers/toolbox'

enum AI_ACTIONS {
  Pair = 'pair',
  Aisay = 'aisay',
}

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
  shouldShowDragHandle?: boolean
  isAiStep: boolean
}

function isAiStep(step: IStep): boolean {
  return Object.values(AI_ACTIONS).includes(step?.appKey as AI_ACTIONS) ?? false
}

export function useStepMetadata(
  allApps: IApp[],
  step: IStep | undefined,
  readOnly?: boolean,
  allowReorder?: boolean,
  isMobile?: boolean,
  isDrawerOpen?: boolean,
): UseStepMetadataResult {
  const isCompleted = step?.status === 'completed'
  const isTrigger = step?.type === 'trigger'
  const isIfThenStep = step ? checkIfThenStep(step) : false

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

  const { caption, defaultCaption } = getStepName(allApps, step)

  const substeps = selectedActionOrTrigger?.substeps || []
  const hasConnection = substeps?.some(
    (substep: ISubstep) => substep.key === 'chooseConnection',
  )

  /**
   * NOTE: there are various conditions that determine whether the drag handle
   * should be shown.
   *
   * - not read only
   * - not in mobile view
   * - step is not a trigger
   * - step is not an if-then condition step
   * - allowReorder is true
   * - side drawer is not open
   */
  const shouldShowDragHandle = useMemo(() => {
    return (
      !readOnly &&
      !isTrigger &&
      !isMobile &&
      !isIfThenStep &&
      allowReorder &&
      !isDrawerOpen
    )
  }, [readOnly, isTrigger, isMobile, isIfThenStep, allowReorder, isDrawerOpen])

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
    shouldShowDragHandle,
    isAiStep: step ? isAiStep(step) : false,
  }
}

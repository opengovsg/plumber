import { IAction, IApp, IStep, ISubstep, ITrigger } from '@plumber/types'

import { useContext, useMemo } from 'react'
import get from 'lodash/get'

import { EditorContext } from '@/contexts/Editor'
import { FORMSG_APP_KEY, MRF_ACTION_KEY } from '@/helpers/formsg'
import getStepName from '@/helpers/getStepName'
import {
  isIfThenStep as checkIfThenStep,
  TOOLBOX_ACTIONS,
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
  shouldShowDragHandle?: boolean
  isDeletable: boolean
  isMrfStep: boolean
  isApprovalStep: boolean
}

export function useStepMetadata(
  step: IStep | undefined,
  allowReorder?: boolean,
): UseStepMetadataResult {
  const { readOnly, isMobile, isDrawerOpen, allApps } =
    useContext(EditorContext)

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

  const isDeletable = useMemo(
    () =>
      !readOnly &&
      step?.key !== TOOLBOX_ACTIONS.IfThen &&
      step?.key !== TOOLBOX_ACTIONS.ForEach &&
      !selectedActionOrTrigger?.hiddenFromUser,
    [readOnly, selectedActionOrTrigger, step?.key],
  )

  const isMrfStep =
    step?.appKey === FORMSG_APP_KEY && step?.key === MRF_ACTION_KEY

  const isApprovalStep =
    isMrfStep && !!get(step?.parameters, 'mrf.approvalField', false)

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
      !isDrawerOpen &&
      !isMrfStep
    )
  }, [
    readOnly,
    isTrigger,
    isMobile,
    isIfThenStep,
    allowReorder,
    isDrawerOpen,
    isMrfStep,
  ])

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
    isDeletable,
    isMrfStep,
    isApprovalStep,
  }
}

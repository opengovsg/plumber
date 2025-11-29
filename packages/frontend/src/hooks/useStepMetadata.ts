import {
  IAction,
  IApp,
  IStep,
  IStepApprovalBranch,
  ISubstep,
  ITrigger,
} from '@plumber/types'

import { useContext, useMemo } from 'react'

import { EditorContext } from '@/contexts/Editor'
import { MrfContext } from '@/contexts/MrfContext'
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
  approvalBranch: IStepApprovalBranch | null
}

export function useStepMetadata(
  step: IStep | undefined,
  allowReorder?: boolean,
): UseStepMetadataResult {
  const { readOnly, isMobile, isDrawerOpen, allApps } =
    useContext(EditorContext)
  const { mrfSteps, approvalBranches } = useContext(MrfContext)

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

  const isMrfStep = useMemo(() => {
    return mrfSteps.some((mrfStep) => mrfStep.id === step?.id)
  }, [mrfSteps, step?.id])

  const isApprovalStep = useMemo(() => {
    if (!step?.id) {
      return false
    }
    return approvalBranches[step.id] !== undefined
  }, [approvalBranches, step?.id])

  const approvalBranch = useMemo(() => {
    // If step not instantiated, return null
    if (!step) {
      return null
    }
    // If not MRF workflow, return null
    if (!mrfSteps.length || !step) {
      return null
    }
    // If step is an MRF step, return null
    if (isMrfStep) {
      return null
    }
    if (step.config.approval?.branch === 'reject') {
      return 'reject'
    }
    // Find the most immediate prior mrfStep by iterating from the last to the first.
    let immediatePriorMrfStep = null
    for (let i = mrfSteps.length - 1; i >= 0; i--) {
      const mrfStep = mrfSteps[i]
      if (mrfStep.position < step.position) {
        immediatePriorMrfStep = mrfStep
        break
      }
    }
    // if is approval step, return whether
    if (!immediatePriorMrfStep) {
      console.warn(
        'No immediate prior mrf step found... this should not happen tho',
      )
      return null
    }
    /**
     * If no approval step config exists, but is part of an mrf branch,
     * it's part of the approve branch by default
     */
    if (approvalBranches[immediatePriorMrfStep.id]) {
      return 'approve'
    }
    // If follows a non-approval mrf step, return null
    return null
  }, [step, mrfSteps, isMrfStep, approvalBranches])

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
    approvalBranch,
  }
}

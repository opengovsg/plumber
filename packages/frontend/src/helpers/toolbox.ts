import { useMutation } from '@apollo/client'
import type { IStep } from '@plumber/types'
import { useCallback, useState } from 'react'

import { UPDATE_STEP } from '@/graphql/mutations/update-step'

export const TOOLBOX_APP_KEY = 'toolbox'

// Signals a fresh if-then V2 block's self-reference on createStep — the real
// id doesn't exist until after insert. Mirrors the backend's
// SELF_END_STEP_SENTINEL (apps/toolbox/common/validate-end-step.ts).
export const SELF_END_STEP_SENTINEL = 'self'

export enum TOOLBOX_ACTIONS {
  IfThen = 'ifThen',
  ForEach = 'forEach',
  OnlyContinueIf = 'onlyContinueIf',
}

export function isOnlyContinueIfStep(step: IStep): boolean {
  return (
    step.appKey === TOOLBOX_APP_KEY &&
    step.key === TOOLBOX_ACTIONS.OnlyContinueIf
  )
}

//
// Helpers for If-then
//
// TODO: Move into separate file if we get more toolbox stuff.
//

export function isIfThenStep(step: IStep): boolean {
  return step.appKey === TOOLBOX_APP_KEY && step.key === TOOLBOX_ACTIONS.IfThen
}

/**
 * Hook for initializing an if-then V2 block on a step that already exists
 * before its app/key are chosen (e.g. a template, or an empty action left
 * over on an old pipe) — `Editor.onCreateStep` handles a freshly-created
 * if-then itself, via the SELF_END_STEP_SENTINEL on createStep.
 *
 * Preserves `config.approval` alongside the marker (updateStep merges
 * config), so a block created inside an MRF rejection branch stays confined
 * to it, per the backend's region rule.
 */
export function useIfThenV2Initializer(): [
  (currStep: IStep) => Promise<IStep>,
  boolean,
] {
  const [isInitializing, setIsInitializing] = useState(false)

  const [updateStep] = useMutation(UPDATE_STEP, { fetchPolicy: 'no-cache' })

  const initialize = useCallback(
    async (currStep: IStep) => {
      setIsInitializing(true)

      const approvalConfig = currStep.config?.approval
        ? { approval: currStep.config.approval }
        : {}

      await updateStep({
        variables: {
          input: {
            id: currStep.id,
            appKey: TOOLBOX_APP_KEY,
            key: TOOLBOX_ACTIONS.IfThen,
            flow: {
              id: currStep.flowId,
              updatedAt: currStep.flow.updatedAt,
            },
            parameters: {
              depth: 0,
            },
            connection: {
              id: null,
            },
            config: { ...approvalConfig, endStepId: currStep.id },
          },
        },
      })

      setIsInitializing(false)

      // The caller refetches GET_FLOW; this hook doesn't.
      return currStep
    },
    [updateStep],
  )

  return [initialize, isInitializing]
}

//
// Helpers for For-each
//
export function isForEachStep(step: IStep): boolean {
  return step.appKey === TOOLBOX_APP_KEY && step.key === TOOLBOX_ACTIONS.ForEach
}

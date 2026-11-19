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
 * Extracts an array of step arrays, with each step array containing steps that
 * comprise a branch with depth === `currDepth`.
 *
 * Each step array contains:
 * 1. In the 1st element, a branch step (i.e. `key` === 'IfThen') with
 *    depth === `currDepth`.
 * 2. The remaining elements are steps belonging to that branch.
 */
export function extractBranchesWithSteps(
  steps: IStep[],

  // We can't extract current depth from steps[0].parameters.depth - it may be
  // undefined if the user has just chosen "If-then" via the
  // "Choose app & event" substep. We grab it from the context instead; it's
  // guaranteed to be correct via induction.
  //
  // Note: Only the _1st branch step_ of a branch series with the same depth
  // can have undefined depth. Other branches with the same depth have to be
  // created via our createBranch callback, which sets the depth explicitly.
  currDepth: number,
): Array<IStep[]> {
  const [firstStep, ...remainingSteps] = steps

  const result: Array<IStep[]> = []
  let branchWithSteps: IStep[] = [firstStep]

  for (const step of remainingSteps) {
    if (!isIfThenStep(step)) {
      branchWithSteps.push(step)
      continue
    }

    const stepDepth = parseInt(step.parameters.depth as string)

    // If depth is NaN, then this step is either a nested branch that was just
    // created by the user via the "Choose app & event" substep, or an if-then
    // V2 step (V2 never sets parameters.depth; config.endStepId carries its
    // extent instead). A just-created branch cannot have a depth <= currDepth;
    // this needs us to cross a branch created with a createBranch mutation
    // _AND_ that branch also has its depth <= currDepth. Thus it must always
    // be part of the current branch, so we add it to `branchWithSteps`. A
    // marked V2 if-then has no such guarantee, so it always starts a new
    // branch instead, the same as a same-depth V1 sibling below.
    if (isNaN(stepDepth)) {
      if (step.config?.endStepId != null) {
        result.push(branchWithSteps)
        branchWithSteps = [step]
        continue
      }
      branchWithSteps.push(step)
      continue
    }

    // Higher depth steps are definitely part of this branch, because we break
    // the loop if we encounter any steps with depth <= currDepth.
    if (stepDepth > currDepth) {
      branchWithSteps.push(step)
      continue
    }

    // We encountered another branch of the same depth, so restart the branch
    // step array.
    if (currDepth === stepDepth) {
      result.push(branchWithSteps)
      branchWithSteps = [step]
    }

    // We found a branch that is a sibling of our parent branch; this happens
    // when we are rendering nested branches. All further steps must not be part
    // of this branch, so just return.
    if (stepDepth < currDepth) {
      result.push(branchWithSteps)
      return result
    }
  }

  result.push(branchWithSteps)

  return result
}

export function isIfThenBranchCompleted(branchSteps: IStep[]): boolean {
  return (
    // Branches without concrete actions are not considered complete.
    branchSteps.length > 1 &&
    branchSteps.every((step) => step.status === 'completed')
  )
}

/**
 * Scrappy O(n) function to check branch completion, including nested branches.
 *
 * NOTE: This is not optimal, since nested If-thens will re-check their steps
 * again. But it's a lot less complex than re-parsing steps or doing some sort
 * of callback system. We can optimize this in a separate PR if this is too
 * jank.
 */
export function areAllIfThenBranchesCompleted(
  allBranches: IStep[],
  depth: number,
): boolean {
  const branches = extractBranchesWithSteps(allBranches, depth)
  return branches.every(isIfThenBranchCompleted)
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

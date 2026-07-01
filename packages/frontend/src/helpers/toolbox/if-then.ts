import { IApp, type IStep } from '@plumber/types'

import { useCallback, useContext, useState } from 'react'
import { useMutation } from '@apollo/client'

import { BranchContext } from '@/components/FlowStepGroup/Content/IfThen/BranchContext'
import { CREATE_STEP } from '@/graphql/mutations/create-step'
import { UPDATE_STEP } from '@/graphql/mutations/update-step'

import { getGroupingActions, TOOLBOX_ACTIONS, TOOLBOX_APP_KEY } from './common'
import type { StepRegion } from './region-list'

//
// Helpers for If-then
//

export function isIfThenStep(step: IStep | null | undefined): step is IStep {
  return (
    !!step &&
    step.appKey === TOOLBOX_APP_KEY &&
    step.key === TOOLBOX_ACTIONS.IfThen
  )
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

    // If depth is NaN, then this step is a nested branch that was just created
    // by the user via the "Choose app & event" substep. It cannot have a depth
    // <= currDepth; this needs us to cross a branch created with a createBranch
    // mutation _AND_ that branch also has its depth <= currDepth.
    //
    // Thus this step must always be part of the current branch, so we add it to
    // `branchWithSteps`.
    if (isNaN(stepDepth)) {
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
 * Hook used for initializing If-then when the user _first_ chooses it via the
 * "Choose App & Event" substep.
 */
export function useIfThenInitializer(): [
  (currStep: IStep) => Promise<IStep>,
  boolean,
] {
  const [isInitializing, setIsInitializing] = useState(false)
  const { depth } = useContext(BranchContext)

  // We run these in parallel without updating the cache, and explicitly
  // re-fetch pipe _after_. This is because we don't want users on slow
  // connections to see Branch 1, then have Branch 2 pop up later; this is uber
  // confusing.
  //
  // It's kinda dangerous in that we're relying on GET_FLOW to contain whatever
  // UPDATE_STEP and CREATE_STEP would have returned, but this should be fine
  // since GET_FLOW should constitute a full refresh of the pipe.
  const [updateStep] = useMutation(UPDATE_STEP, { fetchPolicy: 'no-cache' })
  const [createStep] = useMutation(CREATE_STEP, { fetchPolicy: 'no-cache' })

  const initialize = useCallback(
    async (currStep: IStep) => {
      setIsInitializing(true)

      const commonConfig = {
        ...(currStep.config?.approval && {
          approval: currStep.config?.approval,
        }),
      }

      // Create Branch 2 first so Branch 1 can point its step to jump to
      // (stepIdToJumpTo) at Branch 2's if-then. A freshly created block is the
      // last thing in the flow, so Branch 2 — the block's last branch — stops
      // execution: its stepIdToJumpTo is the "stop" sentinel (null).
      const createSecondBranch = await createStep({
        variables: {
          input: {
            key: TOOLBOX_ACTIONS.IfThen,
            appKey: TOOLBOX_APP_KEY,
            previousStep: {
              id: currStep.id,
            },
            flow: {
              id: currStep.flowId,
              updatedAt: currStep.flow.updatedAt,
            },
            parameters: {
              depth,
              branchName: 'Branch 2',
              stepIdToJumpTo: null,
            },
            config: commonConfig,
          },
        },
      })
      const createdSecondBranch = createSecondBranch?.data?.createStep

      const updateFirstBranch = await updateStep({
        variables: {
          input: {
            id: currStep.id,
            appKey: TOOLBOX_APP_KEY,
            key: TOOLBOX_ACTIONS.IfThen,
            flow: {
              id: currStep.flowId,
              updatedAt: createdSecondBranch.flow.updatedAt,
            },
            parameters: {
              branchName: 'Branch 1',
              depth,
              stepIdToJumpTo: createdSecondBranch.id,
            },
            connection: {
              id: null,
            },
            // no need to set config here since it's already set
          },
        },
      })
      const updatedFirstBranch = updateFirstBranch?.data?.updateStep

      // After creating branches, we create a sample step to each branch. This is
      // because users always get confused on how to add actions within a
      // branch.
      //
      // FIXME (ogp-weeloong): Intentionally serial; need to fix createSteps to
      // enable concurrent updates on same pipe.
      const createFirstStep = await createStep({
        variables: {
          input: {
            previousStep: {
              id: currStep.id,
            },
            flow: {
              id: currStep.flowId,
              updatedAt: updatedFirstBranch?.flow?.updatedAt,
            },
            config: commonConfig,
          },
        },
      })
      const createdFirstStep = createFirstStep?.data?.createStep
      await createStep({
        variables: {
          input: {
            previousStep: {
              id: createdSecondBranch.id,
            },
            flow: {
              id: currStep.flowId,
              updatedAt: createdFirstStep?.flow?.updatedAt,
            },
            config: commonConfig,
          },
        },
      })

      setIsInitializing(false)

      // we dont refetch GET_FLOW here but leave it to the caller to refetch

      return currStep
    },
    [createStep, depth, updateStep],
  )

  return [initialize, isInitializing]
}

//
// Flow structure
//
// These live here (rather than common) because they split the flow around
// if-then groups and so depend on `extractBranchesWithSteps`.
//
export function getStepStructure(
  appsWithActions: IApp[],
  steps: IStep[],
): [IStep | null, IStep[], IStep[][]] {
  const groupingActions = getGroupingActions(appsWithActions)

  if (!groupingActions) {
    return [null, [], []]
  }

  const groupStepIdx = steps.findIndex((step, index) => {
    if (
      // We ignore the 1st step because it's either a trigger, or a
      // step-grouping action that is using a nested Editor to edit steps in
      // its group.
      index === 0 ||
      !step.appKey ||
      !step.key
    ) {
      return false
    }
    return groupingActions.has(`${step.appKey}-${step.key}`)
  })

  let branchesWithSteps: IStep[][] = []
  if (groupStepIdx !== -1) {
    branchesWithSteps = extractBranchesWithSteps(steps.slice(groupStepIdx), 0)
  }

  const triggerStep = steps[0]

  return groupStepIdx === -1
    ? [triggerStep, steps.slice(1), []]
    : [triggerStep, steps.slice(1, groupStepIdx), branchesWithSteps]
}

//
// Jump targets
//
// The write-side companion to `buildRegionList` (in region-list.ts): given a
// region list, derive what each if-then branch's `stepIdToJumpTo` should be.
// Kept here because it writes an if-then parameter and its only value
// dependency is `isIfThenStep`; it references the `StepRegion` shape as a
// type only (erased at runtime, so no import cycle with region-list.ts).
//

/**
 * Computes what each if-then branch's `stepIdToJumpTo` should be for a given
 * region list: within a block, branch[i] points to branch[i+1]'s if-then;
 * the last branch points to the first step of the following region, or `null`
 * when the block is last (the "stop" sentinel). We use `null` rather than
 * `undefined` so the target is always persisted — every if-then in a new-style
 * pipe keeps the key present, so execution never falls back to the legacy scan.
 * The write-path callers persist these targets.
 */
export function computeJumpTargets(
  regions: StepRegion[],
): Map<string, string | null> {
  const targets = new Map<string, string | null>()

  for (let r = 0; r < regions.length; r++) {
    const region = regions[r]
    if (region.type !== 'Block') {
      continue
    }
    const { branches } = region

    // For-each blocks don't use stepIdToJumpTo.
    if (!isIfThenStep(branches[0]?.[0])) {
      continue
    }

    for (let b = 0; b < branches.length; b++) {
      const ifThenId = branches[b][0].id

      if (b < branches.length - 1) {
        // Non-last branch => the next branch's if-then.
        targets.set(ifThenId, branches[b + 1][0].id)
        continue
      }

      // Last branch => the first step of the following region, or null (stop)
      // when the block is last.
      const nextRegion = regions[r + 1]
      const nextFirstStepId = !nextRegion
        ? null
        : nextRegion.type === 'SingleSteps'
        ? nextRegion.steps[0]?.id
        : nextRegion.branches[0]?.[0]?.id
      targets.set(ifThenId, nextFirstStepId ?? null)
    }
  }

  return targets
}

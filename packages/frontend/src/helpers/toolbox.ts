import { IApp, type IStep } from '@plumber/types'

import { useCallback, useContext, useState } from 'react'
import { useMutation } from '@apollo/client'

import { BranchContext } from '@/components/FlowStepGroup/Content/IfThen/BranchContext'
import { CREATE_STEP } from '@/graphql/mutations/create-step'
import { UPDATE_STEP } from '@/graphql/mutations/update-step'

export const TOOLBOX_APP_KEY = 'toolbox'

export enum TOOLBOX_ACTIONS {
  IfThen = 'ifThen',
  ForEach = 'forEach',
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

      const updateFirstBranch = await updateStep({
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
              branchName: 'Branch 1',
              depth,
            },
            connection: {
              id: null,
            },
            // no need to set config here since it's already set
          },
        },
      })
      const updatedFirstBranch = updateFirstBranch?.data?.updateStep
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
              updatedAt: updatedFirstBranch?.flow?.updatedAt,
            },
            parameters: {
              depth,
              branchName: 'Branch 2',
            },
            config: commonConfig,
          },
        },
      })
      const createdSecondBranch = createSecondBranch?.data?.createStep
      const [_firstBranch, secondBranch] = await Promise.all([
        updateFirstBranch,
        createSecondBranch,
      ])

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
              updatedAt: createdSecondBranch.flow.updatedAt,
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
              id: secondBranch.data.createStep.id,
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
// Helpers for For-each
//
export function isForEachStep(step: IStep): boolean {
  return step.appKey === TOOLBOX_APP_KEY && step.key === TOOLBOX_ACTIONS.ForEach
}

//
// General toolbox helpers
//
export function getGroupingActions(appsWithActions: IApp[]) {
  if (!appsWithActions) {
    return null
  }

  return new Set(
    appsWithActions?.flatMap((app) =>
      app.actions
        ?.filter((action) => action.groupsLaterSteps)
        ?.map((action) => `${app.key}-${action.key}`),
    ) ?? [],
  )
}

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

export function getStepGroupTypeAndCaption(groupedSteps: IStep[][]): {
  stepGroupType: string | null
  stepGroupCaption: string | null
} {
  let stepGroupType: string | null = null
  let stepGroupCaption: string | null = null

  const groupKey = groupedSteps[0]?.[0]?.key
  if (!groupKey) {
    return { stepGroupType: null, stepGroupCaption: null }
  }

  if (groupKey === TOOLBOX_ACTIONS.IfThen) {
    stepGroupType = TOOLBOX_ACTIONS.IfThen
    stepGroupCaption = 'If-then'
  }

  if (groupKey === TOOLBOX_ACTIONS.ForEach) {
    stepGroupType = TOOLBOX_ACTIONS.ForEach
    stepGroupCaption = 'For each'
  }

  return { stepGroupType, stepGroupCaption }
}

//
// Region list
//
// Models a flow's action steps (i.e. everything after the trigger) as an
// ordered list of regions, so that single steps can appear after — and between
// — if-then blocks. A `SingleSteps` region is a run of ordinary steps; a `Block`
// region is a chain of if-then branches (or a for-each). See the hidden
// `stepIdToJumpTo` parameter on if-then for how block membership is stored.
//
export type StepRegion =
  | { type: 'SingleSteps'; steps: IStep[] }
  | { type: 'Block'; branches: IStep[][] }

function isGroupingStep(step: IStep, groupingActions: Set<string>): boolean {
  return (
    !!step.appKey &&
    !!step.key &&
    groupingActions.has(`${step.appKey}-${step.key}`)
  )
}

/**
 * Follows the `stepIdToJumpTo` chain from an if-then block's first branch to
 * find the index just past the block (its exit). A branch whose target is
 * another if-then continues the block; a branch whose target is a single step
 * ends it there. Returns `actionSteps.length` when the block runs to the end of
 * the flow (last branch's target absent, or a dangling/backward target).
 */
function findIfThenBlockExitIndex(
  actionSteps: IStep[],
  startIndex: number,
  idToIndex: Map<string, number>,
): number {
  const visited = new Set<string>()
  let current = actionSteps[startIndex]
  let target = current.parameters?.stepIdToJumpTo

  while (typeof target === 'string' && !visited.has(current.id)) {
    visited.add(current.id)
    const targetIndex = idToIndex.get(target)
    const targetStep =
      targetIndex === undefined ? undefined : actionSteps[targetIndex]

    // Target is another if-then => it's the next branch; keep extending.
    if (targetStep && isIfThenStep(targetStep)) {
      current = targetStep
      target = targetStep.parameters?.stepIdToJumpTo
      continue
    }

    // Target is a single step after the block => the block exits there.
    if (targetIndex !== undefined && targetIndex > startIndex) {
      return targetIndex
    }

    // Dangling or backward target: treat the block as running to the end.
    return actionSteps.length
  }

  // No (further) target => block runs to the end of the flow.
  return actionSteps.length
}

/**
 * Models the flow's action steps (steps after the trigger) as an ordered region
 * list. Runs of ordinary steps become `SingleSteps` regions; if-then chains and
 * for-each groups become `Block` regions.
 *
 * Legacy flows lack `stepIdToJumpTo`, so an if-then block runs to the end of the
 * flow (consecutive if-thens = one block) — byte-identical to the previous
 * "group is always last" behaviour. For-each likewise stays a last-step group.
 *
 * The list always begins with a `SingleSteps` region (the steps before the
 * first block, possibly empty) so that a block-first flow renders exactly as
 * before. Otherwise no empty regions are emitted (blocks are separated by >= 1
 * single step, so between-block regions are never empty).
 */
export function buildRegionList(
  actionSteps: IStep[],
  groupingActions: Set<string>,
): StepRegion[] {
  const regions: StepRegion[] = []
  const idToIndex = new Map(actionSteps.map((step, index) => [step.id, index]))

  let singleSteps: IStep[] = []
  // The leading region is always emitted (even if empty); later empty runs are
  // not.
  let isLeadingRegion = true
  const flushSingleSteps = () => {
    if (singleSteps.length > 0 || isLeadingRegion) {
      regions.push({ type: 'SingleSteps', steps: singleSteps })
      singleSteps = []
    }
    isLeadingRegion = false
  }

  let i = 0
  while (i < actionSteps.length) {
    const step = actionSteps[i]

    if (!isGroupingStep(step, groupingActions)) {
      singleSteps.push(step)
      i++
      continue
    }

    // A grouping action starts a Block. The accumulated single steps (the
    // leading region may be empty, mirroring the previous "steps before group")
    // become their own region first.
    flushSingleSteps()

    // For-each stays a last-step group, and a legacy if-then (one with no
    // stored stepIdToJumpTo key) runs to the end of the flow. Otherwise follow
    // the chain to find the exit.
    const isLegacyIfThen =
      isIfThenStep(step) &&
      !Object.hasOwn(step.parameters ?? {}, 'stepIdToJumpTo')
    const exitIndex =
      isForEachStep(step) || isLegacyIfThen
        ? actionSteps.length
        : findIfThenBlockExitIndex(actionSteps, i, idToIndex)

    regions.push({
      type: 'Block',
      branches: extractBranchesWithSteps(actionSteps.slice(i, exitIndex), 0),
    })
    i = exitIndex
  }

  // Flush any trailing single steps (and the leading region for a flow that has
  // no blocks at all, including a flow with no action steps).
  flushSingleSteps()

  return regions
}

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
    if (!branches.length || !isIfThenStep(branches[0][0])) {
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

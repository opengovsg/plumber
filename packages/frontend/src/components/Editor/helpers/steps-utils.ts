import type { IStep } from '@plumber/types'

import { FORMSG_APP_KEY, MRF_ACTION_KEY } from '@/helpers/formsg'
import { isIfThenStep } from '@/helpers/toolbox'

/**
 * Purely a read model derived from the steps: it holds no editing state.
 */
export type StepsListItem = SingleStep | IfThenBlock | ForEachBlock

export interface SingleStep {
  type: 'step'
  step: IStep
}

/**
 * A self-contained if-then block: the if-then step plus the plain steps that
 * run when its condition passes (its children). `endStep` is the last step
 * (inclusive) inside the block. An empty block self-references
 * (`endStep === ifThenStep`, `children === []`).
 *
 * - `isExplicit`: the extent came from a valid if-then V2 `config.endStepId`
 *   marker, rather than being derived from the flat list.
 * - `isDangling`: the if-then carried a marker that was missing or pointed
 *   behind itself, so the extent fell back to the derived one.
 *
 * Children are plain steps only: if-then V2 blocks never nest, and only
 * for-each bodies recurse.
 */
export interface IfThenBlock {
  type: 'ifThenBlock'
  ifThenStep: IStep
  children: IStep[]
  endStepId: string
  endStep: IStep
  isExplicit: boolean
  isDangling: boolean
}

/**
 * Swallows every later step as its body. The body is a recursively
 * structured list so if-then blocks render inside it.
 */
export interface ForEachBlock {
  type: 'forEachBlock'
  forEachStep: IStep
  children: StepsListItem[]
}

/**
 * Reads an if-then V1's nesting depth from `parameters.depth`, mirroring how
 * the flow editor and the backend do. Nesting never shipped for if-then V2
 * blocks, so this is inert defense.
 */
function parseDepth(step: IStep): number {
  const depth = parseInt(step.parameters?.depth as string)
  return isNaN(depth) ? 0 : depth
}

/**
 * Derives an if-then V1 (marker-less) block's extent: the last step
 * (inclusive) inside the block. This mirrors the backend's
 * `deriveIfThenV1EndStep` so an if-then V1 displays over exactly the range it
 * actually executes over. An empty block (the next if-then immediately
 * follows) resolves to the if-then itself (self-reference).
 *
 * `actionSteps` is the MRF-filtered action-step list (trigger removed), ordered
 * by position. Because that list is already filtered to a single approval
 * branch, "the next if-then that passes the MRF same-approval-branch check" is
 * simply "the next if-then in the list".
 */
export function deriveIfThenV1EndStep(
  actionSteps: IStep[],
  ifThenStep: IStep,
): IStep {
  const startIndex = actionSteps.findIndex((step) => step.id === ifThenStep.id)
  const currDepth = parseDepth(ifThenStep)

  const nextBoundaryIndex = actionSteps.findIndex(
    (step, index) =>
      index > startIndex && isIfThenStep(step) && parseDepth(step) <= currDepth,
  )

  if (nextBoundaryIndex === -1) {
    return actionSteps[actionSteps.length - 1]
  }
  return actionSteps[nextBoundaryIndex - 1]
}

function isMrfSubmissionStep(step: IStep): boolean {
  return step.appKey === FORMSG_APP_KEY && step.key === MRF_ACTION_KEY
}

/**
 * Resolves the if-then's endStep exactly as `buildIfThenBlock` would, so the
 * confinement check reasons about the same extent the block renders.
 */
function resolveBlockEndStep(
  flowSteps: IStep[],
  ifThenStep: IStep,
  startIndex: number,
): IStep {
  const markerId = ifThenStep.config?.endStepId
  if (markerId != null) {
    const markerIndex = flowSteps.findIndex((step) => step.id === markerId)
    if (markerIndex !== -1 && markerIndex >= startIndex) {
      return flowSteps[markerIndex]
    }
  }
  return deriveIfThenV1EndStep(flowSteps, ifThenStep)
}

/**
 * Mirrors the backend's `getRejectionBranchId`. `config.approval` is only
 * ever written for rejection branches, so its `stepId` (the approval step
 * the branch hangs off) identifies the branch on its own.
 */
function getRejectionBranchId(step: IStep): string | null {
  return step.config?.approval?.stepId ?? null
}

/**
 * Whether the if-then's block extent is confined to a single MRF region, so
 * an `endStepId` write over it would pass the backend's region check.
 * Mirrors `checkEndStepWrite`'s region rule (validate-end-step.ts).
 *
 * IMPORTANT: pass the full `flow.steps`, not the MRF-filtered display list.
 * That list can hide a boundary step that still sits inside the block's
 * full-flow range.
 */
export function isIfThenBlockRegionConfined(
  flowSteps: IStep[],
  ifThenStep: IStep,
): boolean {
  const startIndex = flowSteps.findIndex((step) => step.id === ifThenStep.id)
  if (startIndex === -1) {
    return false
  }

  const endStep = resolveBlockEndStep(flowSteps, ifThenStep, startIndex)
  const endIndex = flowSteps.findIndex((step) => step.id === endStep.id)
  const blockRejectionBranchId = getRejectionBranchId(ifThenStep)

  for (let index = startIndex + 1; index <= endIndex; index++) {
    const step = flowSteps[index]
    if (
      isMrfSubmissionStep(step) ||
      getRejectionBranchId(step) !== blockRejectionBranchId
    ) {
      return false
    }
  }
  return true
}

/**
 * `groupingActions` is the set of `<appKey>-<key>` action ids that group
 * later steps (`groupsLaterSteps`): if-then and for-each today.
 */
export function buildStepsList(
  actionSteps: IStep[],
  groupingActions: Set<string>,
): StepsListItem[] {
  const items: StepsListItem[] = []
  let index = 0

  while (index < actionSteps.length) {
    const step = actionSteps[index]

    if (isIfThenStep(step)) {
      const { item, nextIndex } = buildIfThenBlock(actionSteps, index)
      items.push(item)
      index = nextIndex
      continue
    }

    if (groupingActions.has(`${step.appKey}-${step.key}`)) {
      items.push({
        type: 'forEachBlock',
        forEachStep: step,
        children: buildStepsList(actionSteps.slice(index + 1), groupingActions),
      })
      break
    }

    items.push({ type: 'step', step })
    index += 1
  }

  return items
}

/**
 * Resolves a single if-then step into an {@link IfThenBlock} and reports the
 * index just past the block. A block inside an MRF rejection branch is
 * nothing special here: write validation keeps it within its branch, so its
 * marker is read like any other.
 *
 * IMPORTANT: the marker test is `!= null`, not `Object.hasOwn`. These steps
 * are read over GraphQL, whose responses carry every field the query
 * selected, so a marker-less if-then arrives with `config.endStepId === null`
 * rather than with the key absent. (The backend, reading the same marker off
 * its own DB rows, uses `Object.hasOwn`, since there the key really can be
 * missing.)
 */
function buildIfThenBlock(
  actionSteps: IStep[],
  startIndex: number,
): { item: IfThenBlock; nextIndex: number } {
  const ifThenStep = actionSteps[startIndex]
  const hasExplicitMarker = ifThenStep.config?.endStepId != null

  let endIndex: number
  let isExplicit: boolean
  let isDangling = false

  if (hasExplicitMarker) {
    const markerId = ifThenStep.config?.endStepId
    const markerIndex = actionSteps.findIndex((step) => step.id === markerId)
    if (markerIndex === -1 || markerIndex < startIndex) {
      // A missing or behind-self marker is corrupt: degrade gracefully to the
      // derived extent and flag it rather than rendering a broken block.
      console.warn(
        `If-then step "${ifThenStep.id}" has a dangling endStepId marker ` +
          `"${markerId ?? ''}"; falling back to the derived block extent.`,
      )
      isDangling = true
      isExplicit = false
      endIndex = getIfThenV1EndIndex(actionSteps, ifThenStep)
    } else {
      isExplicit = true
      endIndex = markerIndex
    }
  } else {
    isExplicit = false
    endIndex = getIfThenV1EndIndex(actionSteps, ifThenStep)
  }

  const endStep = actionSteps[endIndex]

  return {
    item: {
      type: 'ifThenBlock',
      ifThenStep,
      // Steps in (ifThen, endStep]; empty for a self-referencing block.
      children: actionSteps.slice(startIndex + 1, endIndex + 1),
      endStepId: endStep.id,
      endStep,
      isExplicit,
      isDangling,
    },
    nextIndex: endIndex + 1,
  }
}

function getIfThenV1EndIndex(actionSteps: IStep[], ifThenStep: IStep): number {
  const endStep = deriveIfThenV1EndStep(actionSteps, ifThenStep)
  return actionSteps.findIndex((step) => step.id === endStep.id)
}

/**
 * Whether `step` is a member (child) of some if-then block in the flow — the
 * if-then step itself is not "inside" its own block. Recurses into for-each
 * bodies so a step inside an if-then nested under a for-each still counts.
 */
export function isStepInsideIfThenBlock(
  step: IStep,
  actionSteps: IStep[],
  groupingActions: Set<string>,
): boolean {
  const isInIfThenBlock = (items: StepsListItem[]): boolean =>
    items.some((item) => {
      if (item.type === 'ifThenBlock') {
        return item.children.some((child) => child.id === step.id)
      }
      if (item.type === 'forEachBlock') {
        return isInIfThenBlock(item.children)
      }
      return false
    })

  return isInIfThenBlock(buildStepsList(actionSteps, groupingActions))
}

/**
 * Whether any if-then V2 block in the flow is empty. Mirrors the backend's
 * `isIfThenV2` check: a block is empty when its `endStepId` marker points at
 * itself.
 *
 * Takes the full `flow.steps`, not the MRF-filtered display list: a block on
 * an approval branch that is not on screen must still block publish.
 */
export function hasEmptyIfThenV2Block(flowSteps: IStep[]): boolean {
  return flowSteps.some(
    (step) => isIfThenStep(step) && step.config?.endStepId === step.id,
  )
}

/**
 * Whether `step` sits anywhere inside a for-each body (at any depth) — the
 * for-each step itself is not "inside" its own body.
 */
export function isStepInsideForEachBody(
  step: IStep,
  actionSteps: IStep[],
  groupingActions: Set<string>,
): boolean {
  const bodyContainsStep = (items: StepsListItem[]): boolean =>
    items.some((item) => {
      if (item.type === 'step') {
        return item.step.id === step.id
      }
      if (item.type === 'ifThenBlock') {
        return (
          item.ifThenStep.id === step.id ||
          item.children.some((child) => child.id === step.id)
        )
      }
      return item.forEachStep.id === step.id || bodyContainsStep(item.children)
    })

  const isInForEachBody = (items: StepsListItem[]): boolean =>
    items.some(
      (item) => item.type === 'forEachBlock' && bodyContainsStep(item.children),
    )

  return isInForEachBody(buildStepsList(actionSteps, groupingActions))
}

/**
 * Whether the flow already has an if-then V2 block. `useIfThenV2Enabled` uses
 * this to keep rendering the V2 UI once a pipe has one, regardless of the LD
 * flag. The V1 renderer has no concept of the marker and would silently
 * absorb steps that are actually outside the block.
 *
 * IMPORTANT: pass the full `flow.steps`, not the MRF-filtered display list,
 * so a marker on an off-screen branch still counts.
 */
export function hasIfThenV2Block(flowSteps: IStep[]): boolean {
  return flowSteps.some(
    (step) => isIfThenStep(step) && step.config?.endStepId != null,
  )
}

/**
 * Whether `step` is a blank placeholder left by the if-then V1 branch
 * initializer — no app or event ever chosen. Mirrors the backend's
 * `isBlankPlaceholderStep` (toolbox/common/constants.ts): createStep only
 * omits both fields together, for exactly this case, so a step is never
 * mid-configuration with just one of them unset.
 */
export function isBlankPlaceholderStep(step: IStep): boolean {
  return !step.appKey && !step.key
}

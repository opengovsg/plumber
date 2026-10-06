import type { IStep } from '@plumber/types'

import { isMrfApprovalStep } from '@/helpers/formsg'
import { isForEachStep, isIfThenStep } from '@/helpers/toolbox'

/**
 * A step as the AI builder sees it: a proposal action (`ifThenChildCount`
 * from WORKFLOW_METADATA) or a pipe-state step (`endStepId` from the DB).
 */
export interface PreviewStep extends IStep {
  description?: string
  connectionLabel?: string | null
  endStepId?: string | null
  ifThenChildCount?: number
  // A proposal has no parameters to read, so its approval stage carries a flag.
  isApproval?: boolean
}

/** Whether the step is an MRF approval stage, in a pipe or in a proposal. */
export function isApprovalPreviewStep(step: PreviewStep): boolean {
  return step.isApproval === true || isMrfApprovalStep(step)
}

export type PreviewItem =
  | { type: 'step'; step: PreviewStep }
  | { type: 'ifThenBlock'; ifThenStep: PreviewStep; children: PreviewStep[] }
  | { type: 'forEachBlock'; forEachStep: PreviewStep; children: PreviewItem[] }

/**
 * Number of steps inside the If block starting at `index`. Falls back to the
 * legacy derived extent (up to the next if-then or the end) for a step that
 * carries neither a marker nor a metadata count.
 */
function getIfThenChildCount(steps: PreviewStep[], index: number): number {
  const ifThenStep = steps[index]

  const endStepId = ifThenStep.endStepId ?? ifThenStep.config?.endStepId
  if (endStepId != null) {
    const endIndex = steps.findIndex((step) => step.id === endStepId)
    if (endIndex >= index) {
      return endIndex - index
    }
  }

  if (typeof ifThenStep.ifThenChildCount === 'number') {
    return Math.min(ifThenStep.ifThenChildCount, steps.length - index - 1)
  }

  let count = 0
  for (let i = index + 1; i < steps.length; i++) {
    if (isIfThenStep(steps[i])) {
      break
    }
    count++
  }
  return count
}

/**
 * Groups the action steps (trigger excluded) into the same block structure
 * the editor renders: If blocks with a bounded extent, and a for-each whose
 * body is every later step.
 */
export function buildPreviewItems(actionSteps: PreviewStep[]): PreviewItem[] {
  const items: PreviewItem[] = []
  let index = 0

  while (index < actionSteps.length) {
    const step = actionSteps[index]

    if (isIfThenStep(step)) {
      const childCount = getIfThenChildCount(actionSteps, index)
      items.push({
        type: 'ifThenBlock',
        ifThenStep: step,
        children: actionSteps.slice(index + 1, index + 1 + childCount),
      })
      index += 1 + childCount
      continue
    }

    if (isForEachStep(step)) {
      items.push({
        type: 'forEachBlock',
        forEachStep: step,
        children: buildPreviewItems(actionSteps.slice(index + 1)),
      })
      break
    }

    items.push({ type: 'step', step })
    index += 1
  }

  return items
}

/**
 * Whether the block step itself tested successfully.
 *
 * The editor withholds the check on an empty block. A lone blank
 * placeholder counts as empty.
 */
export function isTestedPreviewBlock(
  item: Extract<PreviewItem, { type: 'ifThenBlock' | 'forEachBlock' }>,
  completedStepIds: ReadonlySet<string>,
): boolean {
  const blockStep =
    item.type === 'ifThenBlock' ? item.ifThenStep : item.forEachStep
  if (blockStep.id == null || !completedStepIds.has(blockStep.id)) {
    return false
  }
  if (item.type === 'forEachBlock') {
    return item.children.length > 0
  }
  if (item.children.length !== 1) {
    return item.children.length > 0
  }
  const onlyChild = item.children[0]
  return Boolean(onlyChild.appKey || onlyChild.key)
}

/** Every step inside `item`, at any depth, in position order. */
export function flattenPreviewItem(item: PreviewItem): PreviewStep[] {
  switch (item.type) {
    case 'step':
      return [item.step]
    case 'ifThenBlock':
      return [item.ifThenStep, ...item.children]
    case 'forEachBlock':
      return [item.forEachStep, ...item.children.flatMap(flattenPreviewItem)]
  }
}

import type { IStep } from '@plumber/types'

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

import type { IStep } from '@plumber/types'

import {
  BLOCK_END_STEP_ID,
  isBlankPlaceholderStep,
  isIfThenStep,
  isIfThenV2,
  type StepLike,
} from '../../../common/constants'

// Loose enough that unit tests can pass partial plain objects instead of full
// Step rows.
type ExtentStep = StepLike &
  Pick<IStep, 'id' | 'position'> &
  Partial<Pick<IStep, 'parameters'>>

// Loose enough that unit tests can pass partial plain objects instead of
// full Step rows.
// IMPORTANT: callers must pass steps ordered by position ascending.
type RepairStep = StepLike & Pick<IStep, 'id' | 'position'>

export interface EndStepPatch {
  ifThenStepId: string
  endStepId: string
}

// Mirrors getIfThenV1StepIdToSkipTo's depth defaulting; nesting never shipped,
// so this is dead-code defense.
function parseDepth(step: ExtentStep): number {
  const depth = parseInt(step.parameters?.depth as string)
  return isNaN(depth) ? 0 : depth
}

/**
 * Computes a V1 if-then block's derived extent (the last step, inclusive).
 *
 * IMPORTANT: this is a plain positional scan with no MRF awareness, so it can
 * derive an extent that crosses an mrfSubmission or a rejection-branch
 * boundary — region-confinement write validation is the safety net that
 * refuses to pin one that does.
 */
export function deriveIfThenV1EndStep<T extends ExtentStep>(
  flowSteps: T[],
  ifThenStep: T,
): T {
  const startIndex = flowSteps.findIndex((step) => step.id === ifThenStep.id)
  const currDepth = parseDepth(ifThenStep)

  const nextBoundaryIndex = flowSteps.findIndex(
    (step, index) =>
      index > startIndex && isIfThenStep(step) && parseDepth(step) <= currDepth,
  )

  if (nextBoundaryIndex === -1) {
    return flowSteps[flowSteps.length - 1]
  }
  return flowSteps[nextBoundaryIndex - 1]
}

/**
 * Finds blank placeholder steps inside a V1 block's derived range, so the
 * V1 -> V2 upgrade can drop them instead of pinning them into a V2 block's
 * initial membership. V2 blocks start empty and never grow one on their own.
 */
export function findBlankPlaceholderMemberIds<T extends ExtentStep>(
  flowSteps: T[],
  ifThenStep: T,
  endStep: T,
): string[] {
  return flowSteps
    .filter(
      (step) =>
        step.position > ifThenStep.position &&
        step.position <= endStep.position &&
        isBlankPlaceholderStep(step),
    )
    .map((step) => step.id)
}

/**
 * IMPORTANT: `stepsBeforeDelete` must be ordered by position ascending and
 * reflect pre-delete positions. A block whose own if-then was deleted needs
 * no repair here — block-expansion removes it whole instead.
 */
export function reassignIfThenEndStepsOnDelete<T extends RepairStep>(
  stepsBeforeDelete: T[],
  deletedIds: string[],
): EndStepPatch[] {
  const deleted = new Set(deletedIds)
  const patches: EndStepPatch[] = []

  for (const step of stepsBeforeDelete) {
    if (!isIfThenV2(step) || deleted.has(step.id)) {
      continue
    }
    const oldEndStepId = step.config?.[BLOCK_END_STEP_ID]
    // endStep survived, or the marker was already dangling — nothing to repair.
    if (oldEndStepId === undefined || !deleted.has(oldEndStepId)) {
      continue
    }
    const oldEnd = stepsBeforeDelete.find((s) => s.id === oldEndStepId)
    if (!oldEnd) {
      continue
    }

    let endStepId = step.id
    let endPosition = step.position
    for (const candidate of stepsBeforeDelete) {
      if (
        !deleted.has(candidate.id) &&
        candidate.position > step.position &&
        candidate.position <= oldEnd.position &&
        candidate.position > endPosition
      ) {
        endStepId = candidate.id
        endPosition = candidate.position
      }
    }
    patches.push({ ifThenStepId: step.id, endStepId })
  }

  return patches
}

/**
 * Expands a requested delete set so deleting a new-style if-then also
 * deletes its whole block range. A client that already sent the full range
 * (e.g. an old-UI branch delete) is a no-op via the set union.
 *
 * IMPORTANT: `flowSteps` must be ordered by position ascending.
 */
export function expandIfThenBlockDeletions<T extends RepairStep>(
  flowSteps: T[],
  requestedIds: string[],
): { expandedIds: Set<string>; danglingIfThenIds: string[] } {
  const requested = new Set(requestedIds)
  const expandedIds = new Set(requestedIds)
  const danglingIfThenIds: string[] = []

  for (const step of flowSteps) {
    if (!requested.has(step.id) || !isIfThenV2(step)) {
      continue
    }
    const endStepId = step.config?.[BLOCK_END_STEP_ID]
    const endStep = flowSteps.find((s) => s.id === endStepId)
    if (!endStep || endStep.position < step.position) {
      danglingIfThenIds.push(step.id)
      continue
    }
    for (const member of flowSteps) {
      if (
        member.position >= step.position &&
        member.position <= endStep.position
      ) {
        expandedIds.add(member.id)
      }
    }
  }

  return { expandedIds, danglingIfThenIds }
}

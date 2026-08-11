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

/**
 * Computes marker reassignments after a reorder. A reorder never changes
 * block membership, so a block moved as a whole unit produces no patch —
 * only an endStep that's no longer the highest-positioned member does.
 *
 * IMPORTANT: `preSteps` must be ordered by position ascending.
 */
export function reassignIfThenEndStepsOnReorder<T extends RepairStep>(
  preSteps: T[],
  newPositions: { id: string; position: number }[],
): EndStepPatch[] {
  const newPositionById = new Map(
    newPositions.map(({ id, position }) => [id, position]),
  )
  const positionOf = (step: T): number =>
    newPositionById.get(step.id) ?? step.position

  const patches: EndStepPatch[] = []

  for (const step of preSteps) {
    if (!isIfThenV2(step)) {
      continue
    }
    const oldEndStepId = step.config?.[BLOCK_END_STEP_ID]
    const oldEnd = preSteps.find((s) => s.id === oldEndStepId)
    // A dangling marker is out of scope for reorder repair.
    if (!oldEnd) {
      continue
    }
    const members = preSteps.filter(
      (s) => s.position > step.position && s.position <= oldEnd.position,
    )
    // An empty (self-referencing) block has nothing to reassign.
    if (members.length === 0) {
      continue
    }

    let newEnd = members[0]
    for (const member of members) {
      if (positionOf(member) > positionOf(newEnd)) {
        newEnd = member
      }
    }
    if (newEnd.id !== oldEndStepId) {
      patches.push({ ifThenStepId: step.id, endStepId: newEnd.id })
    }
  }

  return patches
}

/**
 * Remaps if-then markers after a whole-flow duplication. `endStepId` is a
 * forward reference, so this must run as a post-pass once every step has a
 * copy.
 *
 * IMPORTANT: returned patch ids are the NEW (copied) step ids, not the
 * source ids.
 */
export function remapIfThenEndStepIdsOnDuplicate<T extends RepairStep>(
  sourceSteps: T[],
  oldToNewStepIds: Record<string, string>,
): { patches: EndStepPatch[]; danglingSourceStepIds: string[] } {
  const patches: EndStepPatch[] = []
  const danglingSourceStepIds: string[] = []

  for (const step of sourceSteps) {
    if (!isIfThenV2(step)) {
      continue
    }
    const newIfThenId = oldToNewStepIds[step.id]
    const newEndStepId = oldToNewStepIds[step.config?.[BLOCK_END_STEP_ID] ?? '']
    if (newIfThenId === undefined) {
      continue
    }
    if (newEndStepId === undefined) {
      danglingSourceStepIds.push(step.id)
      continue
    }
    patches.push({ ifThenStepId: newIfThenId, endStepId: newEndStepId })
  }

  return { patches, danglingSourceStepIds }
}

/**
 * Remaps if-then markers after a branch duplication. `sourceSelection[i]`
 * was copied to `newStepIds[i]`.
 *
 * IMPORTANT: markers are read from the source rows, never from
 * client-copied config values.
 */
export function remapIfThenEndStepIdsOnDuplicateBranch<T extends RepairStep>(
  sourceSelection: T[],
  newStepIds: string[],
): { patches: EndStepPatch[]; strippedSourceStepIds: string[] } {
  const patches: EndStepPatch[] = []
  const strippedSourceStepIds: string[] = []

  for (let i = 0; i < sourceSelection.length; i++) {
    const sourceStep = sourceSelection[i]
    if (!isIfThenV2(sourceStep)) {
      continue
    }
    const oldEndStepId = sourceStep.config?.[BLOCK_END_STEP_ID]
    const endIndex = sourceSelection.findIndex((s) => s.id === oldEndStepId)
    if (endIndex === -1) {
      strippedSourceStepIds.push(sourceStep.id)
      continue
    }
    patches.push({
      ifThenStepId: newStepIds[i],
      endStepId: newStepIds[endIndex],
    })
  }

  return { patches, strippedSourceStepIds }
}

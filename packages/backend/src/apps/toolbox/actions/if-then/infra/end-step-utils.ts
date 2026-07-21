import type { IStep } from '@plumber/types'

import {
  BLOCK_END_STEP_ID,
  isBlankPlaceholderStep,
  isIfThenStep,
  isIfThenV2,
  type StepLike,
} from '../../../common/constants'

// StepLike (appKey/key/config, all optional) plus the fields the extent scan
// needs directly: id/position (used unconditionally) and parameters (depth,
// read defensively). Real Objection `Step` rows satisfy it, and unit tests can
// pass partial plain objects.
type ExtentStep = StepLike &
  Pick<IStep, 'id' | 'position'> &
  Partial<Pick<IStep, 'parameters'>>

// The minimal step shape the structural-repair helpers read: id/position plus
// config (for the marker). Real Objection `Step` rows satisfy it; unit tests
// pass partial plain objects. Callers pass steps ordered by position ascending.
type RepairStep = StepLike & Pick<IStep, 'id' | 'position'>

// A single marker reassignment: pin `ifThenStepId`'s block endStep to `endStepId`.
export interface EndStepPatch {
  ifThenStepId: string
  endStepId: string
}

// Mirrors the depth handling in getIfThenV1StepIdToSkipTo: a missing/garbled
// depth defaults to 0 (nesting never shipped, so this is inert defense).
function parseDepth(step: ExtentStep): number {
  const depth = parseInt(step.parameters?.depth as string)
  return isNaN(depth) ? 0 : depth
}

/**
 * Computes a V1 (legacy, marker-less) if-then block's derived extent — the last
 * step (inclusive) inside the block — as a pure function of the flow's steps.
 * Mirrors the forward scan in `getIfThenV1StepIdToSkipTo`: the extent runs up to
 * the step just before the next if-then at `depth <=` the block's own depth,
 * else to the end of the flow. An empty block (the next if-then immediately
 * follows) resolves to the if-then itself (self-reference).
 *
 * Used by create-step's server-side lazy-upgrade pin. The scan is plain
 * positional order and knows nothing of MRF structure, so a derived extent can
 * run past an mrfSubmission or out of a rejection branch; region-confinement
 * write validation is the safety net that refuses to pin one that does.
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
 * Finds the ids of any blank placeholder steps (see `isBlankPlaceholderStep`)
 * inside a V1 if-then block's derived range `(ifThenStep, endStep]`. Used by
 * the V1 -> V2 opportunistic upgrade to drop these leftover stubs rather than
 * pin them into the block's initial V2 membership: V2 blocks start empty and
 * never grow one on their own, so a survivor here is purely a V1-era
 * artifact from the (now-superseded) branch initializer.
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
 * Computes the marker reassignments needed to keep new-style if-then blocks
 * correct after a delete. For each surviving new-style block whose endStep was
 * among the deleted steps, the block repoints to the highest-positioned
 * surviving member within its old range `(ifThen, oldEnd]`, or to the if-then
 * itself when every member is gone (empty block => self-reference).
 *
 * A block whose own if-then was deleted needs no repair (block-expansion
 * removes such a block whole), and a block whose endStep survived is left
 * alone. Legacy (marker-less) if-thens are never touched. `stepsBeforeDelete`
 * must be ordered by position ascending and reflect the pre-delete positions.
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
 * Expands a requested delete set so that deleting a new-style if-then also
 * deletes its whole block range `[ifThen … endStep]`. A client that already
 * sent the full range (e.g. an old-UI branch delete) is a no-op via the set
 * union. Legacy (marker-less) if-thens keep old-client single-id semantics and
 * are never expanded; a new-style if-then with a dangling / behind-self marker
 * is reported (so the caller can log it) and its block is left un-expanded —
 * only what was asked is deleted. `flowSteps` must be ordered by position
 * ascending.
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
 * Computes the marker reassignments needed to keep new-style if-then blocks
 * correct after a reorder. Each block's membership is fixed by the pre-reorder
 * positions (the steps in `(ifThen, oldEnd]`); its endStep becomes whichever
 * member now sits at the highest position. Only markers that actually changed
 * are returned. A reorder never changes membership, so blocks moved as a unit —
 * and blocks the reorder never touched — produce no patch. Empty
 * (self-referencing) blocks and blocks with a pre-existing dangling marker are
 * left alone. `preSteps` must be ordered by position ascending; `newPositions`
 * gives the post-reorder position of every moved step (unmoved steps keep their
 * pre-reorder position).
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
    // Dangling marker — out of scope for reorder repair.
    if (!oldEnd) {
      continue
    }
    // Members are fixed by pre-reorder position: the steps in (ifThen, oldEnd].
    const members = preSteps.filter(
      (s) => s.position > step.position && s.position <= oldEnd.position,
    )
    // Empty block (self-reference) — nothing to reassign.
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
 * Remaps new-style if-then markers when a whole flow is duplicated. `endStepId`
 * is a forward reference, so it can only be resolved once every step has a
 * copy: this runs as a post-pass over the source steps and the old→new id map.
 * Each source block yields a patch pinning the COPIED if-then to the COPIED
 * endStep; self-references remap for free. A source marker that does not
 * resolve to a copied step (a pre-existing dangling marker) is reported so the
 * caller can fail the whole duplication. Legacy (marker-less) if-thens are
 * ignored. Returned patch ids are the NEW (copied) step ids.
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
 * Remaps new-style if-then markers when a branch (a contiguous selection of
 * steps) is duplicated. The source selection is DB-derived and correlated to
 * the copies ordinally: `sourceSelection[i]` was copied to `newStepIds[i]`.
 * Markers are read from the source rows, never from client-copied values. A
 * source block whose endStep is within the selection yields a patch pinning the
 * copy to the ordinal counterpart's copy (self-references included); a marker
 * pointing outside the selection is reported so the caller can log it and leave
 * the copy marker-less (a graceful legacy copy with a correct derived extent).
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

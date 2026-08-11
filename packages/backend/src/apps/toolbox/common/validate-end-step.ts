import type { IStep, IStepConfig } from '@plumber/types'

import { raw, Transaction } from 'objection'

import {
  deriveIfThenV1EndStep,
  findBlankPlaceholderMemberIds,
  reassignIfThenEndStepsOnDelete,
  reassignIfThenEndStepsOnReorder,
  remapIfThenEndStepIdsOnDuplicate,
  remapIfThenEndStepIdsOnDuplicateBranch,
} from '@/apps/toolbox/actions/if-then/infra/end-step-utils'
import logger from '@/helpers/logger'
import Flow from '@/models/flow'
import Step from '@/models/step'

import {
  BLOCK_END_STEP_ID,
  isIfThenStep,
  isIfThenV2,
  type StepLike,
} from './constants'

// Loose enough for unit tests to pass partial objects instead of full Step
// rows.
type ValidationStep = StepLike & Pick<IStep, 'id' | 'position'>

interface EndStepWriteValidationArgs {
  // IMPORTANT: must already reflect the mutation's own insert/patch, ordered
  // by position ascending.
  flowSteps: ValidationStep[]
  ifThenStepId: string
  endStepId: string
  flowId: string
}

// endStepId is maintained by the endStep write rules and the duplication
// remaps, never accepted directly from the client.
const SERVER_OWNED_CONFIG_KEYS = [BLOCK_END_STEP_ID] as const

/**
 * Strips server-owned keys from a client-supplied config so a mutation only
 * persists the marker via its own server-side rules.
 */
export function sanitizeServerSideConfig(
  config: IStepConfig | null | undefined,
): IStepConfig {
  const sanitized = { ...(config ?? {}) }
  for (const key of SERVER_OWNED_CONFIG_KEYS) {
    delete sanitized[key]
  }
  return sanitized
}

/**
 * IMPORTANT: throws a plain Error, not BadUserInputError — these violations
 * are prevented by the frontend, so hitting one means a bug, not bad input.
 */
export function rejectEndStepWrite(
  reason: string,
  details: Record<string, unknown>,
): never {
  logger.error({ event: 'end-step-write-rejected', reason, ...details })
  throw new Error(`endStepId write rejected: ${reason}`)
}

/**
 * Unlike a write rejection (a should-never-happen bug), publish is the one
 * place a user can trip a bad marker, most notably an empty block. So the
 * message here is actionable and the log level is warn, not error.
 */
function rejectPublishEndStep(
  reason: string,
  details: Record<string, unknown>,
): never {
  logger.warn({ event: 'publish-invalid-end-step', reason, ...details })
  throw new Error(
    reason === 'empty-block'
      ? 'Cannot publish: an If-then block has no steps. Add a step inside it or remove the block.'
      : 'Cannot publish: an If-then block is misconfigured. Contact Plumber support to resolve this.',
  )
}

function isMrfSubmissionStep(step: ValidationStep): boolean {
  return step.appKey === 'formsg' && step.key === 'mrfSubmission'
}

interface EndStepViolation {
  reason: string
  details: Record<string, unknown>
}

/**
 * Which MRF rejection branch a step belongs to, or null for the main flow.
 * `config.approval` is only ever written for rejection branches (its `branch`
 * is typed `'reject'`), so its `stepId` — the approval step the branch hangs
 * off — identifies the branch on its own.
 */
function getRejectionBranchId(step: ValidationStep): string | null {
  return step.config?.approval?.stepId ?? null
}

/**
 * Pure invariant check for a single if-then V2 endStepId. Returns the first
 * violation (reason + details) or null when valid.
 *
 * Shared by the write path (throws) and the publish validator (warns), so
 * the invariant lives in one place. IMPORTANT: a self-referencing (empty)
 * block passes here. Only publish rejects it.
 */
function checkEndStepWrite({
  flowSteps,
  ifThenStepId,
  endStepId,
  flowId,
}: EndStepWriteValidationArgs): EndStepViolation | null {
  const ifThenStep = flowSteps.find((step) => step.id === ifThenStepId)

  // Target must be a toolbox/ifThen present in this flow.
  if (!ifThenStep || !isIfThenStep(ifThenStep)) {
    return { reason: 'target-not-if-then', details: { ifThenStepId, flowId } }
  }

  // endStep must exist in the same flow.
  const endStep = flowSteps.find((step) => step.id === endStepId)
  if (!endStep) {
    return {
      reason: 'end-step-not-in-flow',
      details: { ifThenStepId, endStepId, flowId },
    }
  }

  // endStep must be at or after the if-then (self-ref is the empty block).
  if (endStep.position < ifThenStep.position) {
    return {
      reason: 'end-step-before-self',
      details: {
        ifThenStepId,
        endStepId,
        endStepPosition: endStep.position,
        ifThenPosition: ifThenStep.position,
        flowId,
      },
    }
  }

  // IMPORTANT: a block that crosses this boundary would jump execution into
  // or out of a branch on FALSE.
  const blockRejectionBranchId = getRejectionBranchId(ifThenStep)
  for (const step of flowSteps) {
    if (
      step.position <= ifThenStep.position ||
      step.position > endStep.position
    ) {
      continue
    }
    if (isMrfSubmissionStep(step)) {
      return {
        reason: 'mrf-step-in-region',
        details: { ifThenStepId, endStepId, offendingStepId: step.id, flowId },
      }
    }
    if (getRejectionBranchId(step) !== blockRejectionBranchId) {
      return {
        reason: 'approval-branch-crossed',
        details: {
          ifThenStepId,
          endStepId,
          offendingStepId: step.id,
          blockRejectionBranchId,
          offendingRejectionBranchId: getRejectionBranchId(step),
          flowId,
        },
      }
    }
  }

  // Nesting is never legitimate (depth === 0), so no two ranges may overlap.
  for (const other of flowSteps) {
    if (other.id === ifThenStepId || !isIfThenV2(other)) {
      continue
    }
    const otherEnd = flowSteps.find(
      (step) => step.id === other.config?.[BLOCK_END_STEP_ID],
    )
    // Skip pre-existing dangling markers — out of scope for this write.
    if (!otherEnd) {
      continue
    }
    const overlaps =
      ifThenStep.position <= otherEnd.position &&
      other.position <= endStep.position
    if (overlaps) {
      return {
        reason: 'overlapping-blocks',
        details: {
          ifThenStepId,
          endStepId,
          otherIfThenStepId: other.id,
          flowId,
        },
      }
    }
  }

  return null
}

/**
 * Throws (rolling back the mutation) and logs `end-step-write-rejected` on
 * any `checkEndStepWrite` violation.
 *
 * Exported for unit coverage — mutations should go through
 * `validateEndStepOn{Create,Update}Step` below instead.
 */
export function validateEndStepWrite(args: EndStepWriteValidationArgs): void {
  const violation = checkEndStepWrite(args)
  if (violation) {
    rejectEndStepWrite(violation.reason, violation.details)
  }
}

/**
 * Publish-time check over a whole flow's blocks, so the execution-time
 * fail-loud path in `checkEndStepWrite` stays rare.
 *
 * IMPORTANT: an empty (self-referencing) block is valid mid-edit but
 * rejected here. Unlike the old UI's auto-created empty step, it has no
 * incomplete child of its own to block publish otherwise.
 *
 * `flowSteps` must be ordered by position ascending.
 */
export function validateFlowBlocks(
  flowSteps: ValidationStep[],
  flowId: string,
): void {
  for (const step of flowSteps) {
    if (!isIfThenV2(step)) {
      continue
    }
    const endStepId = step.config?.[BLOCK_END_STEP_ID] ?? ''

    if (endStepId === step.id) {
      rejectPublishEndStep('empty-block', { ifThenStepId: step.id, flowId })
    }

    const violation = checkEndStepWrite({
      flowSteps,
      ifThenStepId: step.id,
      endStepId,
      flowId,
    })
    if (violation) {
      rejectPublishEndStep(violation.reason, violation.details)
    }
  }
}

// The real id doesn't exist until after insert, so this is the only value a
// create-step config.endStepId may carry; anything else is a bug, not a
// legitimate write (it would let a client redefine another block's boundary
// at create time).
export const SELF_END_STEP_SENTINEL = 'self'

/**
 * Splits a create-step config into the config to insert and whether the
 * client asked to self-reference the new step's own marker.
 */
export function extractSelfEndStepIntent(
  config: IStepConfig | null | undefined,
): {
  config: IStepConfig
  wantsSelfEndStep: boolean
} {
  const sanitized = { ...(config ?? {}) }
  if (!Object.hasOwn(sanitized, BLOCK_END_STEP_ID)) {
    return { config: sanitized, wantsSelfEndStep: false }
  }

  const value = sanitized[BLOCK_END_STEP_ID]
  delete sanitized[BLOCK_END_STEP_ID]
  if (value !== SELF_END_STEP_SENTINEL) {
    rejectEndStepWrite('invalid-end-step-sentinel', { value })
  }
  return { config: sanitized, wantsSelfEndStep: true }
}

// Uses jsonb_set so this only touches endStepId, not the rest of config.
export async function pinEndStep(
  trx: Transaction,
  ifThenStepId: string,
  endStepId: string,
): Promise<void> {
  await Step.query(trx)
    .findById(ifThenStepId)
    .patch({
      config: raw(`jsonb_set(config, '{${BLOCK_END_STEP_ID}}', ?::jsonb)`, [
        JSON.stringify(endStepId),
      ]),
    })
}

/**
 * Deletes a V1 block's leftover blank placeholder members and closes the
 * position gaps they leave, highest position first so each target's own
 * recorded position stays valid for the ones still to come.
 *
 * DB-only. The caller re-derives its own view of the flow afterward.
 */
async function deleteBlankPlaceholderMembers(
  trx: Transaction,
  flow: Flow,
  currentSteps: ValidationStep[],
  blankMemberIds: string[],
): Promise<void> {
  const targets = currentSteps
    .filter((step) => blankMemberIds.includes(step.id))
    .sort((a, b) => b.position - a.position)

  for (const target of targets) {
    await Step.query(trx).findById(target.id).delete()
    await flow
      .$relatedQuery('steps', trx)
      .where('position', '>', target.position)
      .patch({ position: raw('position - 1') })
  }
}

/**
 * Derives `ifThenStep`'s current V1 extent after dropping any leftover
 * blank placeholder members (see `isBlankPlaceholderStep`) instead of
 * pinning them into the block's initial V2 membership. A V2 block starts
 * empty and has no equivalent concept, so a survivor here would break its
 * empty/populated conventions.
 *
 * IMPORTANT: `excludeStepIds` (e.g. create-step's own just-inserted step) is
 * excluded from both the derivation and the blank-member scan, so a plain
 * add-after isn't absorbed into a block whose end just shifted from a
 * deletion here.
 *
 * IMPORTANT: deleting a member shifts every later step's position, so
 * `cleaned` signals the caller's own step list is now stale and must be
 * re-fetched.
 */
export async function deriveV1EndStepDroppingBlankMembers(
  trx: Transaction,
  flow: Flow,
  currentSteps: ValidationStep[],
  ifThenStep: ValidationStep,
  excludeStepIds: Set<string>,
): Promise<{ endStep: ValidationStep; cleaned: boolean }> {
  const endStep = deriveIfThenV1EndStep(currentSteps, ifThenStep)

  const blankMemberIds = findBlankPlaceholderMemberIds(
    currentSteps,
    ifThenStep,
    endStep,
  ).filter((id) => !excludeStepIds.has(id))

  if (blankMemberIds.length === 0) {
    return { endStep, cleaned: false }
  }

  await deleteBlankPlaceholderMembers(trx, flow, currentSteps, blankMemberIds)
  logger.info({
    event: 'if-then-v1-blank-members-removed',
    ifThenStepId: ifThenStep.id,
    removedStepIds: blankMemberIds,
    flowId: flow.id,
  })

  const refetchedSteps = (
    await flow.$relatedQuery('steps', trx).orderBy('position', 'asc')
  ).filter((step) => !excludeStepIds.has(step.id))
  return {
    endStep: deriveIfThenV1EndStep(
      refetchedSteps,
      refetchedSteps.find((step) => step.id === ifThenStep.id),
    ),
    cleaned: true,
  }
}

/**
 * Repairs if-then markers after a deleteStep. Runs over the surviving step
 * set (not the deleted ids), so it also covers steps removed indirectly via
 * `removeMrfSteps`.
 *
 * IMPORTANT: a repaired marker only ever shrinks its block, so it stays
 * valid by construction. Structural mutations repair here, never reject.
 */
export async function repairEndStepsOnDeleteStep({
  trx,
  flow,
  stepsBeforeDelete,
}: {
  trx: Transaction
  flow: Flow
  stepsBeforeDelete: Step[]
}): Promise<void> {
  const survivingSteps = await flow.$relatedQuery('steps', trx)
  const survivingIds = new Set(survivingSteps.map((step) => step.id))
  const deletedIds = stepsBeforeDelete
    .map((step) => step.id)
    .filter((id) => !survivingIds.has(id))

  const patches = reassignIfThenEndStepsOnDelete(stepsBeforeDelete, deletedIds)
  for (const { ifThenStepId, endStepId } of patches) {
    await pinEndStep(trx, ifThenStepId, endStepId)
    logger.info({
      event: 'end-step-repaired',
      mutation: 'deleteStep',
      ifThenStepId,
      endStepId,
      flowId: flow.id,
    })
  }
}

/**
 * Repairs if-then markers after an updateStepPositions, patching only the
 * markers that actually changed.
 *
 * IMPORTANT: a repaired marker still points at a block member, so it stays
 * valid by construction. Structural mutations repair here, never reject.
 */
export async function repairEndStepsOnReorder({
  trx,
  flow,
  preSteps,
  newPositions,
}: {
  trx: Transaction
  flow: Flow
  preSteps: Step[]
  newPositions: { id: string; position: number }[]
}): Promise<void> {
  const patches = reassignIfThenEndStepsOnReorder(preSteps, newPositions)
  for (const { ifThenStepId, endStepId } of patches) {
    await pinEndStep(trx, ifThenStepId, endStepId)
    logger.info({
      event: 'end-step-repaired',
      mutation: 'updateStepPositions',
      ifThenStepId,
      endStepId,
      flowId: flow.id,
    })
  }
}

/**
 * Remaps if-then markers after a whole-flow duplication.
 *
 * IMPORTANT: a source marker that fails to resolve means the SOURCE flow
 * itself was corrupt, not this code. Logs and throws so the whole
 * duplication rolls back.
 */
export async function remapEndStepIdsOnDuplicateFlow({
  trx,
  originalFlowId,
  duplicatedFlowId,
  sourceSteps,
  oldToNewStepIds,
}: {
  trx: Transaction
  originalFlowId: string
  duplicatedFlowId: string
  sourceSteps: Step[]
  oldToNewStepIds: Record<string, string>
}): Promise<void> {
  const { patches, danglingSourceStepIds } = remapIfThenEndStepIdsOnDuplicate(
    sourceSteps,
    oldToNewStepIds,
  )

  if (danglingSourceStepIds.length > 0) {
    logger.error({
      event: 'duplicate-flow-dangling-end-step',
      originalFlowId,
      duplicatedFlowId,
      danglingSourceStepIds,
    })
    throw new Error('duplicateFlow: dangling endStepId marker in source flow')
  }

  for (const { ifThenStepId, endStepId } of patches) {
    await pinEndStep(trx, ifThenStepId, endStepId)
  }
}

/**
 * Remaps if-then markers after a branch duplication, deriving the source
 * selection from the DB rather than the client-copied config: a copied
 * marker still references the SOURCE step ids, and older editor bundles
 * don't even send `config.endStepId`.
 *
 * IMPORTANT: called after the insertion loop. The copies land after
 * `previousStep` and only shift later positions, so the source rows'
 * positions are still valid to re-derive from here.
 */
export async function remapEndStepIdsOnDuplicateBranch({
  trx,
  flow,
  previousStepId,
  newSteps,
}: {
  trx: Transaction
  flow: Flow
  previousStepId: string
  newSteps: Step[]
}): Promise<void> {
  const previousStep = await flow
    .$relatedQuery('steps', trx)
    .findOne({ id: previousStepId })
    .throwIfNotFound()
  const sourceSelection = await flow
    .$relatedQuery('steps', trx)
    .where('position', '>=', previousStep.position - newSteps.length + 1)
    .andWhere('position', '<=', previousStep.position)
    .orderBy('position', 'asc')

  // A mismatch means the derivation invariant (previousStep is the
  // selection's last step) didn't hold. Degrade to marker-less copies rather
  // than risk a wrong remap.
  if (sourceSelection.length !== newSteps.length) {
    logger.warn({
      event: 'duplicate-branch-stripped-end-step',
      reason: 'source-selection-size-mismatch',
      flowId: flow.id,
      sourceCount: sourceSelection.length,
      copyCount: newSteps.length,
    })
    return
  }

  const { patches, strippedSourceStepIds } =
    remapIfThenEndStepIdsOnDuplicateBranch(
      sourceSelection,
      newSteps.map((step) => step.id),
    )

  for (const sourceStepId of strippedSourceStepIds) {
    logger.info({
      event: 'duplicate-branch-stripped-end-step',
      flowId: flow.id,
      sourceStepId,
    })
  }

  for (const { ifThenStepId, endStepId } of patches) {
    await pinEndStep(trx, ifThenStepId, endStepId)
  }
}

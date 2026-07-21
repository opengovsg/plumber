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
import { getLdFlagValue } from '@/helpers/launch-darkly'
import logger from '@/helpers/logger'
import Flow from '@/models/flow'
import Step from '@/models/step'

import {
  BLOCK_END_STEP_ID,
  isBlockStep,
  isIfThenStep,
  isIfThenV2,
  type StepLike,
} from './constants'

// StepLike (appKey/key/config, all optional) plus id/position, which the
// validator uses directly. Real Objection `Step` rows satisfy it; unit tests
// pass partial plain objects.
type ValidationStep = StepLike & Pick<IStep, 'id' | 'position'>

interface EndStepWriteValidationArgs {
  // Flow steps ordered by position ascending, reflecting the final positions
  // after any insert/patch the mutation has already applied.
  flowSteps: ValidationStep[]
  // The if-then receiving the marker.
  ifThenStepId: string
  // The endStepId value being written.
  endStepId: string
  flowId: string
}

// Config keys the server owns; a client must never set them directly. endStepId
// is maintained entirely by the endStep write rules and the duplication remaps.
const SERVER_OWNED_CONFIG_KEYS = [BLOCK_END_STEP_ID] as const

/**
 * Strips server-owned keys from a client-supplied config so a mutation only
 * persists the marker via its own server-side rules. Used by create-step and
 * duplicate-branch.
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
 * Logs a structured rejection and throws a plain Error so the enclosing
 * transaction rolls back. These states are prevented by the frontend, so a
 * violation is a bug — not user input (hence a plain Error, not
 * BadUserInputError).
 */
function rejectEndStepWrite(
  reason: string,
  details: Record<string, unknown>,
): never {
  logger.error({ event: 'end-step-write-rejected', reason, ...details })
  throw new Error(`endStepId write rejected: ${reason}`)
}

/**
 * Logs a structured publish rejection and throws a user-facing error. Unlike a
 * write rejection (a should-never-happen bug), publish is the one place a user
 * can trip a bad marker — most notably an empty block — so the message is
 * actionable and the log level is warn.
 */
function rejectPublishEndStep(
  reason: string,
  details: Record<string, unknown>,
): never {
  logger.warn({ event: 'publish-invalid-end-step', reason, ...details })
  throw new Error(
    reason === 'empty-block'
      ? 'Cannot publish: an If-then block has no steps. Add a step inside it or remove the block.'
      : 'Cannot publish: an If-then block is misconfigured. Refresh the page and try again.',
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
 * Pure invariant check for a single if-then V2 endStepId: the target is a
 * toolbox/ifThen in this flow; the endStep exists and sits at/after it; the
 * block region `(ifThen, end]` holds no mrfSubmission and stays within the
 * if-then's own MRF region (the main flow, or one rejection branch); and the
 * block does not overlap another if-then V2 block. Returns the first violation
 * (reason + details) or null when the write is valid. Shared by the write path
 * (which throws) and the publish validator (which warns) so the invariant lives
 * in one place. A self-referencing (empty) block passes here; only publish
 * rejects it.
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

  // Region confinement: the block must live inside one MRF region. It may hold
  // no mrfSubmission, and every step in it must sit in the same place in the
  // MRF structure as the if-then — all in the main flow, or all in the same
  // rejection branch. A block that crossed that boundary would jump execution
  // into or out of a branch on FALSE.
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

  // Pairwise disjointness: the new range [ifThen, end] must not overlap any
  // other if-then V2 block's range. Nesting is never legitimate (depth === 0).
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
 * Enforces every invariant an if-then V2 endStepId write must satisfy (see
 * `checkEndStepWrite`). Violations log `end-step-write-rejected` and throw,
 * rolling back the mutation. Exported for unit coverage; mutations should call
 * the `validateEndStepOn{Create,Update}Step` helpers below.
 */
export function validateEndStepWrite(args: EndStepWriteValidationArgs): void {
  const violation = checkEndStepWrite(args)
  if (violation) {
    rejectEndStepWrite(violation.reason, violation.details)
  }
}

/**
 * Publish-time tripwire over a whole flow's blocks (a step carrying an endStepId
 * marker is, by definition, a block), so the runtime fail-loud path stays rare.
 * Every new-style if-then block must satisfy the write invariant (via
 * checkEndStepWrite: resolves, at/after self, region-confined, disjoint) AND
 * must not be empty. An empty (self-referencing) block is valid mid-edit —
 * delete/reorder repair to self-ref — but is rejected here: unlike the old UI's
 * auto-created empty step, it has no incomplete child to block publish. Any
 * violation logs `publish-invalid-end-step` and throws a user-facing error.
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

    // Empty (self-referencing) block: allowed mid-edit, not publishable.
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

// Surgically sets config.endStepId in-transaction, preserving other config keys.
async function pinEndStep(
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

// Mirrors packages/frontend/src/config/flags.ts's IF_THEN_THEN_FEATURE_FLAG.
const IF_THEN_THEN_LD_FLAG_KEY = 'feature_if_then_then'

/**
 * Deletes a V1 block's leftover blank placeholder members and closes the
 * position gaps they leave, highest position first so each target's own
 * recorded position stays valid for the ones still to come. DB-only; the
 * caller re-derives its own view of the flow afterward.
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
 * Derives `ifThenStep`'s current V1 extent, deleting any leftover blank
 * placeholder member(s) first (see `isBlankPlaceholderStep`) rather than
 * sweeping them into the block's initial V2 membership: a V1 block can carry
 * one from the (now-superseded) branch initializer, but a V2 block has no
 * equivalent concept and starts empty, so a survivor here would render
 * inconsistently with a native V2 block's own empty/populated conventions.
 * `excludeStepIds` is kept out of both the derivation and the blank-member
 * scan — e.g. create-step's own just-inserted step, so a plain add-after
 * isn't absorbed into a block whose true end has shifted underneath it from
 * a deletion here.
 *
 * Deleting a member shifts every later step's position, so cleanup re-derives
 * off a freshly re-fetched, complete step list rather than patching
 * `currentSteps` in place. Returns whether that happened — exactly when the
 * caller's own copy of the flow's steps is now stale, position-wise.
 */
async function deriveV1EndStepDroppingBlankMembers(
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
 * Opportunistically pins every legacy (V1) if-then block in a flow to its
 * current derived extent, when the if-then-then flag is on for the flow
 * owner. Once pinned, a block is protected forever after by the existing V2
 * repair logic (`repairEndStepsOnReorder`/`repairEndStepsOnDeleteStep`) — this
 * only ever needs to run the initial pin. Called opportunistically from
 * create-step, delete-step, and update-step-positions so a block's extent
 * gets locked in before a structural mutation can silently change it.
 *
 * A region-confinement violation on a pre-existing block throws exactly like
 * the create-step pin path does (see `validateEndStepWrite`) — a background
 * pass over a never-before-validated block can trip this on an edit unrelated
 * to that block; this is an accepted risk, not a bug to defend against here.
 */
export async function upgradeIfThenV1BlocksIfEnabled(
  trx: Transaction,
  flow: Flow,
  flowSteps: ValidationStep[],
  excludeStepIds: Set<string> = new Set(),
): Promise<void> {
  const v1IfThens = flowSteps.filter(
    (step) =>
      isIfThenStep(step) && !isIfThenV2(step) && !excludeStepIds.has(step.id),
  )
  if (v1IfThens.length === 0) {
    return
  }

  const owner = await flow
    .$relatedQuery('user', trx)
    .select('email')
    .throwIfNotFound()
  const isEnabled = await getLdFlagValue(
    IF_THEN_THEN_LD_FLAG_KEY,
    owner.email,
    false,
  )
  if (!isEnabled) {
    return
  }

  let currentSteps = flowSteps

  for (const ifThenStep of v1IfThens) {
    const liveIfThenStep = currentSteps.find(
      (step) => step.id === ifThenStep.id,
    )
    const { endStep, cleaned } = await deriveV1EndStepDroppingBlankMembers(
      trx,
      flow,
      currentSteps,
      liveIfThenStep,
      excludeStepIds,
    )
    if (cleaned) {
      currentSteps = await flow
        .$relatedQuery('steps', trx)
        .orderBy('position', 'asc')
    }

    validateEndStepWrite({
      flowSteps: currentSteps,
      ifThenStepId: ifThenStep.id,
      endStepId: endStep.id,
      flowId: flow.id,
    })
    await pinEndStep(trx, ifThenStep.id, endStep.id)
  }
}

/**
 * Maintains if-then endStepId markers when a step is created, in the same
 * transaction as the insert. A new step is placed either AFTER a block (the
 * client signals which via previousBlockId) or somewhere plain:
 *
 *   - Added AFTER a block (previousBlockId set): the block's endStep must be the
 *     step the new one follows. A marker-less (V1) block is lazily upgraded by
 *     pinning it to its derived extent so the new step lands outside — dropping
 *     any leftover blank placeholder member first, same as the opportunistic
 *     upgrade pass (see `deriveV1EndStepDroppingBlankMembers`); an already
 *     marked block needs no write (the check is just a bug tripwire).
 *   - A plain step added at a marked block's tail (previousBlockId absent):
 *     extend that block to include it — this also covers first-add into an empty
 *     (self-referencing) block. A new if-then/for-each is never absorbed.
 *
 * Any violation throws (rolling back the whole creation).
 */
export async function validateEndStepOnCreateStep({
  trx,
  flow,
  previousBlockId,
  previousStep,
  newStep,
}: {
  trx: Transaction
  flow: Flow
  previousBlockId: string | null | undefined
  previousStep: Step
  newStep: Step
}): Promise<void> {
  const flowId = flow.id
  const flowSteps = await flow
    .$relatedQuery('steps', trx)
    .orderBy('position', 'asc')

  // Added AFTER a block.
  if (previousBlockId != null) {
    const blockStep = flowSteps.find((step) => step.id === previousBlockId)
    if (!blockStep || !isIfThenStep(blockStep)) {
      rejectEndStepWrite('previous-block-not-if-then', {
        previousBlockId,
        flowId,
      })
    }

    // Already-marked block: nothing to pin; verify previousStep is its endStep.
    if (isIfThenV2(blockStep)) {
      const explicitEndStepId = blockStep.config[BLOCK_END_STEP_ID]
      if (previousStep.id !== explicitEndStepId) {
        rejectEndStepWrite('previous-step-not-block-end', {
          previousBlockId,
          previousStepId: previousStep.id,
          endStepId: explicitEndStepId,
          flowId,
        })
      }
      return
    }

    // Marker-less (V1) block: derive its extent from the pre-insert order
    // (exclude the new step so a plain add-after isn't absorbed), then pin it.
    const preInsertSteps = flowSteps.filter((step) => step.id !== newStep.id)
    const preBlockStep = preInsertSteps.find(
      (step) => step.id === previousBlockId,
    )
    const derivedEndStep = deriveIfThenV1EndStep(preInsertSteps, preBlockStep)
    if (previousStep.id !== derivedEndStep.id) {
      rejectEndStepWrite('previous-step-not-block-end', {
        previousBlockId,
        previousStepId: previousStep.id,
        endStepId: derivedEndStep.id,
        flowId,
      })
    }

    // Drop the block's own leftover V1 blank placeholder member(s), if any,
    // before pinning — same as the opportunistic upgrade pass — so a block
    // lazily upgraded via an add-after-block insert never carries one into
    // its initial V2 membership either. The new step is excluded from the
    // re-derivation for the same reason it was excluded above.
    const { endStep: finalEndStep, cleaned } =
      await deriveV1EndStepDroppingBlankMembers(
        trx,
        flow,
        preInsertSteps,
        preBlockStep,
        new Set([newStep.id]),
      )
    const finalFlowSteps = cleaned
      ? await flow.$relatedQuery('steps', trx).orderBy('position', 'asc')
      : flowSteps

    validateEndStepWrite({
      flowSteps: finalFlowSteps,
      ifThenStepId: blockStep.id,
      endStepId: finalEndStep.id,
      flowId,
    })
    await pinEndStep(trx, blockStep.id, finalEndStep.id)
    return
  }

  // Plain step added at a marked block's tail: extend that block.
  if (!isBlockStep(newStep)) {
    const blockToExtend = flowSteps.find(
      (step) =>
        isIfThenV2(step) && step.config[BLOCK_END_STEP_ID] === previousStep.id,
    )
    if (blockToExtend) {
      validateEndStepWrite({
        flowSteps,
        ifThenStepId: blockToExtend.id,
        endStepId: newStep.id,
        flowId,
      })
      await pinEndStep(trx, blockToExtend.id, newStep.id)
    }
  }
}

/**
 * Validates a client-supplied config.endStepId on updateStep and returns the
 * config fragment to merge. The marker is accepted only when the key is present
 * (an absent key is preserved by the caller's config spread); the write is
 * validated against the flow's steps in the same transaction, so an invalid
 * target throws and rolls back before anything is persisted.
 */
export async function validateEndStepOnUpdateStep({
  trx,
  step,
  inputConfig,
  flowId,
}: {
  trx: Transaction
  step: Step
  inputConfig: { [BLOCK_END_STEP_ID]?: string | null } | null | undefined
  flowId: string
}): Promise<{ [BLOCK_END_STEP_ID]?: string }> {
  if (!inputConfig || !Object.hasOwn(inputConfig, BLOCK_END_STEP_ID)) {
    return {}
  }

  const endStepId = inputConfig[BLOCK_END_STEP_ID] as string
  const flowSteps = await Step.query(trx)
    .where('flow_id', flowId)
    .orderBy('position', 'asc')
  validateEndStepWrite({ flowSteps, ifThenStepId: step.id, endStepId, flowId })
  return { [BLOCK_END_STEP_ID]: endStepId }
}

/**
 * Repairs new-style if-then markers after a deleteStep, in the same transaction
 * as the delete. Any surviving block whose endStep was deleted repoints to its
 * highest surviving member (empties to self-reference). Runs over the surviving
 * step set, so it covers both the normal action-step delete and the
 * trigger/MRF branch (which deletes via removeMrfSteps). A repaired marker only
 * ever shrinks its block, so it stays valid by construction — structural
 * mutations repair, never reject, and never add new restrictions.
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
 * Repairs new-style if-then markers after an updateStepPositions, in the same
 * transaction as the position patches. Each block keeps its membership; its
 * endStep becomes the member now at the highest position. Only changed markers
 * are patched. A repaired marker still points at a block member, so it stays
 * valid by construction — structural mutations repair, never reject.
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
 * Remaps new-style if-then markers after a whole flow is duplicated, in the
 * same transaction as the copy. `endStepId` is a forward reference, so this
 * runs as a post-pass once every step has a copy: each copied block is pinned
 * to its copied endStep (self-references remap for free). A source marker that
 * does not resolve to a copied step means the source flow itself was corrupt —
 * logged and thrown so the whole duplication rolls back.
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
 * Remaps new-style if-then markers after a branch is duplicated, in the same
 * transaction as the copy. The source selection is derived from the DB — the
 * `newSteps.length` steps ending at `previousStep`, correlated to the copies
 * ordinally — rather than read from the client-copied config: a copied marker
 * still references the SOURCE step ids (not the new copies), and older editor
 * bundles do not even fetch `config.endStepId`, so its value is wrong or
 * absent. A block whose endStep is within the selection is pinned onto its
 * copy; a marker pointing outside the selection leaves the copy marker-less (a
 * graceful legacy copy) and is logged.
 *
 * Called after the insertion loop: the copies land after `previousStep`, and
 * every position shift touches only later positions, so the source rows keep
 * their positions and can be re-derived here.
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

  // Ordinal correlation is only valid when the derived source rows align 1:1
  // with the copies. A mismatch means the derivation invariant (previousStep is
  // the selection's last step) did not hold — degrade to marker-less copies
  // rather than risk a wrong remap.
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

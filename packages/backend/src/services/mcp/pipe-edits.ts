import type { Transaction } from 'objection'

import Flow from '@/models/flow'
import Step from '@/models/step'
import type User from '@/models/user'

/**
 * Bumps the pipe's updatedAt like the editor's step mutations do.
 *
 * IMPORTANT: Without this, assertNotUpdatedSince lets a collaborator's stale editor save overwrite AI builder edits.
 */
export async function markPipeEdited({
  user,
  pipeId,
  trx,
}: {
  user: User
  pipeId: string
  trx?: Transaction
}): Promise<void> {
  const flow = await Flow.query(trx).findById(pipeId).throwIfNotFound()
  await flow.patchLastUpdated({ flowId: flow.id, updatedBy: user.id, trx })
}

export async function assignStepConnection({
  user,
  pipeId,
  stepId,
  connectionId,
}: {
  user: User
  pipeId: string
  stepId: string
  connectionId: string
}): Promise<void> {
  await Step.transaction(async (trx) => {
    await Step.query(trx)
      .patchAndFetchById(stepId, { connectionId })
      .throwIfNotFound()
    await markPipeEdited({ user, pipeId, trx })
  })
}

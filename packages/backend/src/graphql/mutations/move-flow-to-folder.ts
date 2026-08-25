import { z } from 'zod'

import { BadUserInputError } from '@/errors/graphql-errors'
import Flow from '@/models/flow'
import FlowFolder from '@/models/flow-folder'
import FlowFolderItem from '@/models/flow-folder-item'

import type { MutationResolvers } from '../__generated__/types.generated'

const moveFlowToFolder: MutationResolvers['moveFlowToFolder'] = async (
  _parent,
  params,
  context,
) => {
  const { flowId, folderId } = params.input

  // To avoid the gibberish error code if a caller sends a malformed id
  if (!z.string().uuid().safeParse(flowId).success) {
    throw new BadUserInputError('Please provide a valid pipe ID.')
  }
  // folderId is deliberately nullable (null/omitted = unfile) - only a
  // non-null value must be a valid UUID.
  if (folderId != null && !z.string().uuid().safeParse(folderId).success) {
    throw new BadUserInputError('Please provide a valid folder ID.')
  }

  return await Flow.transaction(async (trx) => {
    // Filing is a personal organisational act, not an edit to the pipe, so
    // viewer access is the correct floor - this also scopes the flow lookup
    // to flows this user can actually see.
    const flow = await context.currentUser
      .withAccessibleFlows({ requiredRole: 'viewer', trx })
      .findOne({ 'flows.id': flowId })
      .throwIfNotFound()

    if (folderId != null) {
      // Scoped by user_id: filing into someone else's folder is impossible -
      // it looks not-found, never a silent success.
      await FlowFolder.query(trx)
        .findOne({ id: folderId, user_id: context.currentUser.id })
        .throwIfNotFound()
    }

    await FlowFolderItem.moveFlowToFolder({
      userId: context.currentUser.id,
      flowId,
      folderId: folderId ?? null,
      trx,
    })

    return flow
  })
}

export default moveFlowToFolder

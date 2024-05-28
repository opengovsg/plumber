import { getOrCreateUser } from '@/helpers/auth'
import { validateAndParseEmail } from '@/helpers/email-validator'
import FlowTransfer from '@/models/flow-transfers'

import type { MutationResolvers } from '../__generated__/types.generated'

const createFlowTransfer: MutationResolvers['createFlowTransfer'] = async (
  _parent,
  params,
  context,
) => {
  const { flowId, newOwnerEmail } = params.input

  // check if flow belongs to the old owner first
  await context.currentUser
    .$relatedQuery('flows')
    .where('id', flowId)
    .throwIfNotFound('This pipe does not belong to you.')

  const validatedEmail = await validateAndParseEmail(newOwnerEmail)
  if (!validatedEmail) {
    throw new Error('Invalid user email.')
  }

  // don't allow transferring of pipe to oneself
  if (context.currentUser.email === validatedEmail) {
    throw new Error(
      'You cannot transfer the pipe to yourself, please type in another email.',
    )
  }

  const newOwner = await getOrCreateUser(validatedEmail) // allow new user to be created if not logged in

  // Sanity check for existing pending transfer to avoid duplicates
  const hasExistingTransfer: boolean =
    (await FlowTransfer.query()
      .findOne({
        flow_id: flowId,
        old_owner_id: context.currentUser.id,
        new_owner_id: newOwner.id,
        status: 'pending',
      })
      .resultSize()) === 1

  if (hasExistingTransfer) {
    throw new Error(
      'Transfer has already been made. Please get the new owner to approve it.',
    )
  }

  const newTransfer: FlowTransfer = await context.currentUser
    .$relatedQuery('sentFlowTransfers')
    .insert({
      flowId,
      oldOwnerId: context.currentUser.id,
      newOwnerId: newOwner.id,
    })
  return newTransfer
}

export default createFlowTransfer

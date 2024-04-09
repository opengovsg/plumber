import FlowTransfer from '@/models/flow-transfers'
import User from '@/models/user'
import Context from '@/types/express/context'

type Params = {
  input: {
    flowId: string
    newOwnerEmail: string
  }
}

const createFlowTransfer = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const { flowId, newOwnerEmail } = params.input

  // check if flow belongs to the old owner first
  await context.currentUser
    .$relatedQuery('flows')
    .where('id', flowId)
    .throwIfNotFound('This pipe does not belong to you.')

  const newOwner = await User.query()
    .findOne({
      email: newOwnerEmail,
    })
    .throwIfNotFound({
      message:
        'User email does not exist on Plumber, please type in an email account of a user who has logged in before.',
    })

  // don't allow transferring of pipe to oneself
  if (context.currentUser.id === newOwner.id) {
    throw new Error(
      'You cannot transfer the pipe to yourself, please type in another email.',
    )
  }

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

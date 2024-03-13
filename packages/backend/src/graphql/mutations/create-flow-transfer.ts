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

  const newOwner = await User.query()
    .findOne({
      email: newOwnerEmail,
    })
    .throwIfNotFound({
      message: 'User email does not exist on Plumber',
    })

  // don't allow transferring of pipe to oneself
  if (context.currentUser.id === newOwner.id) {
    throw new Error(
      'You cannot transfer the pipe to yourself, please type in another email',
    )
  }

  // check for existing pending transfer to avoid duplicates
  const existingTransfer: FlowTransfer = await FlowTransfer.query().findOne({
    flow_id: flowId,
    old_owner_id: context.currentUser.id,
    new_owner_id: newOwner.id,
    status: 'pending',
  })

  if (existingTransfer) {
    throw new Error(
      'Transfer has already been made. Please get the new owner to approve it!',
    )
  }

  const newTransfer: FlowTransfer = await context.currentUser
    .$relatedQuery('sentFlowTransfers')
    .insert({
      flowId,
      oldOwnerId: context.currentUser.id,
      newOwnerId: newOwner.id,
    })
  return newTransfer.id // TODO (mal): change to boolean if not needed
}

export default createFlowTransfer

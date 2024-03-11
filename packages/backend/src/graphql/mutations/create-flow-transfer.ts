import FlowTransfer from '@/models/flow-transfers'
import Context from '@/types/express/context'

type Params = {
  input: {
    flowId: string
    newOwnerId: string
  }
}

const createFlowTransfer = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const { flowId, newOwnerId } = params.input
  const transfer: FlowTransfer = await context.currentUser
    .$relatedQuery('sentFlowTransfers')
    .insert({
      flowId,
      oldOwnerId: context.currentUser.id,
      newOwnerId,
    })
  return transfer.id // TODO (mal): change to boolean if not needed
}

export default createFlowTransfer

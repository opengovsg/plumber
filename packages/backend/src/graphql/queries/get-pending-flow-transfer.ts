import FlowTransfer from '@/models/flow-transfers'
import Context from '@/types/express/context'

type Params = {
  flowId: string
}

const getPendingFlowTransfer = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const flowTransfer = await FlowTransfer.query()
    .findOne({
      flow_id: params.flowId,
      old_owner_id: context.currentUser.id,
      status: 'pending',
    })
    .withGraphFetched({
      newOwner: true,
    })

  // not supposed to throw error if not found so that frontend can process only if present
  if (flowTransfer) {
    return flowTransfer
  }
}

export default getPendingFlowTransfer

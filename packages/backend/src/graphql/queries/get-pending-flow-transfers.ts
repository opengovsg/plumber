import FlowTransfer from '@/models/flow-transfers'
import Context from '@/types/express/context'

const getPendingFlowTransfers = async (
  _parent: unknown,
  _params: unknown,
  context: Context,
) => {
  const flowTransfers = await FlowTransfer.query()
    .where({ new_owner_id: context.currentUser.id, status: 'pending' })
    .withGraphFetched({
      oldOwner: true,
      newOwner: true,
      flow: true,
    })
  return flowTransfers
}

export default getPendingFlowTransfers

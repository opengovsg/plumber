import FlowTransfer from '@/models/flow-transfers'

import type { QueryResolvers } from '../__generated__/types.generated'

const getPendingFlowTransfers: QueryResolvers['getPendingFlowTransfers'] =
  async (_parent, _params, context) => {
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

import type { IFlowTransferStatus } from '@plumber/types'

import Base from '../base'

// IMPORTANT: Holds columns only. The analytics export reads through it without loading the app.
class BaseFlowTransfer extends Base {
  id!: string
  flowId!: string
  oldOwnerId!: string
  newOwnerId!: string
  status!: IFlowTransferStatus

  static tableName = 'flow_transfers'

  static jsonSchema = {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      flowId: { type: 'string', format: 'uuid' },
      oldOwnerId: { type: 'string', format: 'uuid' },
      newOwnerId: { type: 'string', format: 'uuid' },
      status: {
        type: 'string',
        enum: ['pending', 'approved', 'rejected', 'cancelled'],
        default: 'pending',
      },
      deletedAt: { type: 'null' }, // disallow soft deletes
    },
  }
}

export default BaseFlowTransfer

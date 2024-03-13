import { IFlowTransferStatus } from '@plumber/types'

import Base from './base'
import Flow from './flow'
import User from './user'

class FlowTransfer extends Base {
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

  static relationMappings = () => ({
    oldOwner: {
      relation: Base.BelongsToOneRelation,
      modelClass: User,
      join: {
        from: 'flow_transfers.old_owner_id',
        to: 'users.id',
      },
    },
    newOwner: {
      relation: Base.BelongsToOneRelation,
      modelClass: User,
      join: {
        from: 'flow_transfers.new_owner_id',
        to: 'users.id',
      },
    },
    flow: {
      relation: Base.BelongsToOneRelation,
      modelClass: Flow,
      join: {
        from: 'flow_transfers.flow_id',
        to: 'flows.id',
      },
    },
  })
}

export default FlowTransfer

import Base from '../base'
import Flow from '../flow'
import User from '../user'
import BaseFlowTransfer from './base'

class FlowTransfer extends BaseFlowTransfer {
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

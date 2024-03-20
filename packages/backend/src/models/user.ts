import { ITableCollabRole } from '@plumber/types'

import crypto from 'crypto'
import { ModelOptions, QueryContext } from 'objection'

import Base from './base'
import Connection from './connection'
import Execution from './execution'
import Flow from './flow'
import FlowTransfer from './flow-transfers'
import Step from './step'
import TableCollaborator from './table-collaborators'
import TableMetadata from './table-metadata'

class User extends Base {
  id!: string
  email!: string
  otpHash?: string
  otpAttempts: number
  otpSentAt?: Date
  connections?: Connection[]
  flows?: Flow[]
  steps?: Step[]
  executions?: Execution[]
  tables?: TableMetadata[]
  sentFlowTransfers?: FlowTransfer[]
  receivedFlowTransfers?: FlowTransfer[]

  // for typescript support when creating TableCollaborator row in insertGraph
  role?: ITableCollabRole
  lastAccessedAt?: string

  static tableName = 'users'

  static jsonSchema = {
    type: 'object',
    required: ['email'],

    properties: {
      id: { type: 'string', format: 'uuid' },
      email: { type: 'string', format: 'email', minLength: 1, maxLength: 255 },
    },
  }

  static relationMappings = () => ({
    connections: {
      relation: Base.HasManyRelation,
      modelClass: Connection,
      join: {
        from: 'users.id',
        to: 'connections.user_id',
      },
    },
    flows: {
      relation: Base.HasManyRelation,
      modelClass: Flow,
      join: {
        from: 'users.id',
        to: 'flows.user_id',
      },
    },
    steps: {
      relation: Base.ManyToManyRelation,
      modelClass: Step,
      join: {
        from: 'users.id',
        through: {
          from: 'flows.user_id',
          to: 'flows.id',
        },
        to: 'steps.flow_id',
      },
    },
    executions: {
      relation: Base.ManyToManyRelation,
      modelClass: Execution,
      join: {
        from: 'users.id',
        through: {
          from: 'flows.user_id',
          to: 'flows.id',
        },
        to: 'executions.flow_id',
      },
    },
    tables: {
      relation: Base.ManyToManyRelation,
      modelClass: TableMetadata,
      join: {
        from: `${this.tableName}.id`,
        through: {
          modelClass: TableCollaborator,
          from: `${TableCollaborator.tableName}.user_id`,
          to: `${TableCollaborator.tableName}.table_id`,
          extra: {
            role: 'role',
            lastAccessedAt: 'last_accessed_at',
          },
        },
        to: `${TableMetadata.tableName}.id`,
      },
    },
    sentFlowTransfers: {
      relation: Base.HasManyRelation,
      modelClass: FlowTransfer,
      join: {
        from: 'users.id',
        to: 'flow_transfers.old_owner_id',
      },
    },
    receivedFlowTransfers: {
      relation: Base.HasManyRelation,
      modelClass: FlowTransfer,
      join: {
        from: 'users.id',
        to: 'flow_transfers.new_owner_id',
      },
    },
  })

  hashOtp(otp: string) {
    return crypto.scryptSync(otp, this.email, 64).toString('base64')
  }

  async $beforeInsert(queryContext: QueryContext) {
    await super.$beforeInsert(queryContext)
  }

  async $beforeUpdate(opt: ModelOptions, queryContext: QueryContext) {
    await super.$beforeUpdate(opt, queryContext)
  }
}

export default User

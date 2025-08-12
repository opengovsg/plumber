import { ITableCollabRole } from '@plumber/types'

import crypto from 'crypto'
import {
  AnyQueryBuilder,
  ModelOptions,
  QueryContext,
  Transaction,
} from 'objection'

import Base from './base'
import Connection from './connection'
import Execution from './execution'
import Flow from './flow'
import FlowCollaborator from './flow-collaborators'
import FlowTransfer from './flow-transfers'
import ExtendedQueryBuilder from './query-builder'
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
  lastLoginAt?: Date

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
      filter: (query: AnyQueryBuilder) =>
        query.whereNull(`${TableCollaborator.tableName}.deleted_at`),
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
    collaborators: {
      relation: Base.HasManyRelation,
      modelClass: FlowCollaborator,
      join: {
        from: 'users.id',
        to: 'flow_collaborators.user_id',
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

  withAccessibleFlow({
    queryBuilder,
    trx,
  }: {
    queryBuilder?: ExtendedQueryBuilder<Flow, Flow[]>
    trx?: Transaction
  } = {}) {
    const userId = this.id
    const baseQuery = queryBuilder || Flow.query(trx)
    return baseQuery
      .select(
        'flows.*',
        Flow.raw(
          `CASE
        WHEN flows.user_id = ? THEN 'owner'
        ELSE (
          SELECT role FROM flow_collaborators
          WHERE flow_collaborators.flow_id = flows.id
          AND flow_collaborators.user_id = ?
          AND flow_collaborators.deleted_at IS NULL
        )
      END as role`,
          [userId, userId],
        ),
      )
      .where(function () {
        this.where('flows.user_id', userId).orWhereExists(function () {
          this.select(1)
            .from('flow_collaborators')
            .whereRaw('flow_collaborators.flow_id = flows.id')
            .where('flow_collaborators.user_id', userId)
            .whereNull('flow_collaborators.deleted_at')
        })
      })
  }
}

export default User

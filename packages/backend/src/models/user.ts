import { IFlowCollabRole, ITableCollabRole } from '@plumber/types'

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

  /**
   * we use this filter to check for two things:
   * 1. user is a valid owner or collaborator on this pipe
   * 2. user has the required permissions to work on this pipe
   */
  private applyAccessibilityFilter(
    query:
      | ExtendedQueryBuilder<Flow, Flow[]>
      | ExtendedQueryBuilder<Step, Step[]>
      | ExtendedQueryBuilder<Connection, Connection[]>,
    userId: string,
    requiredRole: IFlowCollabRole,
  ) {
    if (requiredRole === 'owner') {
      query.where('flows.user_id', userId)
    } else if (requiredRole === 'editor') {
      query.where(function () {
        this.where('flows.user_id', userId).orWhereExists(function () {
          this.select('*')
            .from('flow_collaborators')
            .whereRaw('flow_collaborators.flow_id = flows.id')
            .where('flow_collaborators.user_id', userId)
            .where('flow_collaborators.role', 'editor')
            .whereNull('flow_collaborators.deleted_at')
        })
      })
    } else if (requiredRole === 'viewer') {
      query.where(function () {
        this.where('flows.user_id', userId).orWhereExists(function () {
          this.select('*')
            .from('flow_collaborators')
            .whereRaw('flow_collaborators.flow_id = flows.id')
            .where('flow_collaborators.user_id', userId)
            .whereIn('flow_collaborators.role', ['editor', 'viewer'])
            .whereNull('flow_collaborators.deleted_at')
        })
      })
    }
  }

  withAccessible(params: {
    type: 'connection'
    queryBuilder?: ExtendedQueryBuilder<Connection, Connection[]>
    trx?: Transaction
    requiredRole?: IFlowCollabRole
  }): ExtendedQueryBuilder<Connection, Connection[]>
  withAccessible(params: {
    type: 'flow'
    queryBuilder?: ExtendedQueryBuilder<Flow, Flow[]>
    trx?: Transaction
    requiredRole?: IFlowCollabRole
  }): ExtendedQueryBuilder<Flow, Flow[]>
  withAccessible(params: {
    type: 'step'
    queryBuilder?: ExtendedQueryBuilder<Step, Step[]>
    trx?: Transaction
    requiredRole?: IFlowCollabRole
  }): ExtendedQueryBuilder<Step, Step[]>
  withAccessible({
    type,
    queryBuilder,
    trx,
    requiredRole = 'viewer',
  }: {
    type: 'flow' | 'step' | 'connection'
    queryBuilder?:
      | ExtendedQueryBuilder<Flow, Flow[]>
      | ExtendedQueryBuilder<Step, Step[]>
      | ExtendedQueryBuilder<Connection, Connection[]>
    trx?: Transaction
    requiredRole?: IFlowCollabRole
  }) {
    const userId = this.id
    const USER_ROLE_STMT = `
      CASE
        WHEN flows.user_id = ? THEN 'owner'
        ELSE (
          SELECT role FROM flow_collaborators
          WHERE flow_collaborators.flow_id = flows.id
          AND flow_collaborators.user_id = ?
          AND flow_collaborators.deleted_at IS NULL
        )
      END as role
    `

    let baseQuery:
      | ExtendedQueryBuilder<Flow, Flow[]>
      | ExtendedQueryBuilder<Step, Step[]>
      | ExtendedQueryBuilder<Connection, Connection[]>

    switch (type) {
      case 'connection':
        baseQuery =
          (queryBuilder as ExtendedQueryBuilder<Connection, Connection[]>) ||
          Connection.query(trx)
        baseQuery
          .select(
            'connections.*',
            Connection.raw(USER_ROLE_STMT, [userId, userId]),
          )
          .join('steps', 'steps.connection_id', 'connections.id')
          .join('flows', 'steps.flow_id', 'flows.id')
          .leftJoin('flow_connections', 'flow_connections.flow_id', 'flows.id')

        break

      case 'step':
        baseQuery =
          (queryBuilder as ExtendedQueryBuilder<Step, Step[]>) ||
          Step.query(trx)
        baseQuery
          .select('steps.*', Step.raw(USER_ROLE_STMT, [userId, userId]))
          .join('flows', 'flows.id', 'steps.flow_id')
        break

      case 'flow':
      default:
        baseQuery =
          (queryBuilder as ExtendedQueryBuilder<Flow, Flow[]>) ||
          Flow.query(trx)
        baseQuery.select('flows.*', Flow.raw(USER_ROLE_STMT, [userId, userId]))
        break
    }

    this.applyAccessibilityFilter(baseQuery, userId, requiredRole)
    return baseQuery
  }

  withAccessibleFlows({
    queryBuilder,
    trx,
  }: {
    queryBuilder?: ExtendedQueryBuilder<Flow, Flow[]>
    trx?: Transaction
  } = {}) {
    const userId = this.id
    const baseQuery = queryBuilder || Flow.query(trx)
    return baseQuery
      .select('flows.*')
      .leftJoin('flow_collaborators as fc', function () {
        this.on('fc.flow_id', 'flows.id').andOnNull('fc.deleted_at')
      })
      .select(
        Flow.raw(
          `CASE
          WHEN flows.user_id = ? THEN 'owner'
          ELSE fc.role
        END as role`,
          [userId],
        ),
      )
      .where(function () {
        this.where('flows.user_id', userId).orWhereNotNull('fc.role')
      })
  }
}

export default User

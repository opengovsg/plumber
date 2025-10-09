import { IFlowCollabRole, ITableCollabRole } from '@plumber/types'

import crypto from 'crypto'
import {
  AnyQueryBuilder,
  ModelOptions,
  QueryContext,
  Transaction,
} from 'objection'

import { getAllowedCollaboratorRoles } from '@/helpers/check-user-permission'

import Base from './base'
import Connection from './connection'
import Execution from './execution'
import Flow from './flow'
import FlowConnections from './flow-connections'
import FlowTransfer from './flow-transfers'
import ExtendedQueryBuilder from './query-builder'
import Step from './step'
import TableCollaborator from './table-collaborators'
import TableMetadata from './table-metadata'

const ROLE_STMT = `
  CASE
    WHEN flows.user_id = ? THEN 'owner'
    ELSE fc.role
  END as role
`

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
    /**
     * NOTE: retain _connections_ and _flows_ relations as they are used to get the owner's
     * connections and flows.
     * It is displayed in the My Apps page.
     */
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
   * Generic method to add flow role information to any query that has a flow relation
   * This can be used with modifyGraph to add role information to flow relations
   */
  withFlowRole(query: AnyQueryBuilder): AnyQueryBuilder {
    const userId = this.id
    return query
      .withGraphFetched('flow')
      .modifyGraph('flow', (flowQuery: any) => {
        // this.applyFlowRoleSelection(flowQuery, userId)
        flowQuery
          .leftJoin('flow_collaborators as fc', function () {
            this.on('fc.flow_id', 'flows.id')
              .andOnNull('fc.deleted_at')
              .andOnVal('fc.user_id', userId)
          })
          .select('flows.*', Flow.raw(ROLE_STMT, [userId]))
      })
  }

  /**
   * we use this filter to check for two things:
   * 1. user is a valid owner or collaborator on this pipe
   * 2. user has the required permissions to work on this pipe
   */
  private applyAccessibilityFilter(
    query: AnyQueryBuilder,
    userId: string,
    requiredRole: IFlowCollabRole,
  ) {
    query.leftJoin('flow_collaborators as fc', function () {
      this.on('fc.flow_id', 'flows.id')
        .andOnNull('fc.deleted_at')
        .andOnVal('fc.user_id', userId)
    })

    if (requiredRole === 'owner') {
      query.where('flows.user_id', userId)
      return
    }

    const allowedRoles = getAllowedCollaboratorRoles(requiredRole)

    query.where(function () {
      this.where('flows.user_id', userId)
        .orWhereNotNull('fc.role')
        .andWhere(function () {
          this.select('*')
            .from('flow_collaborators as fc')
            .whereRaw('fc.flow_id = flows.id')
            .where('fc.user_id', userId)
            .whereIn('fc.role', allowedRoles)
            .whereNull('fc.deleted_at')
        })
    })
  }

  withAccessibleFlows({
    requiredRole,
    queryBuilder,
    trx,
  }: {
    requiredRole: IFlowCollabRole
    queryBuilder?: ExtendedQueryBuilder<Flow, Flow[]>
    trx?: Transaction
  }) {
    const userId = this.id
    const baseQuery = queryBuilder || Flow.query(trx)
    baseQuery.select('flows.*', Flow.raw(ROLE_STMT, [userId]))

    this.applyAccessibilityFilter(baseQuery, userId, requiredRole)
    return baseQuery
  }

  withAccessibleSteps({
    queryBuilder,
    requiredRole,
    trx,
  }: {
    queryBuilder?: ExtendedQueryBuilder<Step, Step[]>
    requiredRole: IFlowCollabRole
    trx?: Transaction
  }) {
    const userId = this.id
    const baseQuery = queryBuilder || Step.query(trx)
    baseQuery.select('steps.*').join('flows', 'flows.id', 'steps.flow_id')

    this.applyAccessibilityFilter(baseQuery, userId, requiredRole)
    this.withFlowRole(baseQuery)
    return baseQuery
  }

  withAccessibleConnections({
    requiredRole,
    queryBuilder,
    trx,
  }: {
    requiredRole: IFlowCollabRole
    queryBuilder?: ExtendedQueryBuilder<Connection, Connection[]>
    trx?: Transaction
  }) {
    const userId = this.id
    const baseQuery = queryBuilder || Connection.query(trx)
    const allowedRoles = getAllowedCollaboratorRoles(requiredRole)

    baseQuery
      .select('connections.*')
      .leftJoin(
        'flow_connections',
        'flow_connections.connection_id',
        'connections.id',
      )
      .leftJoin('flows', 'flows.id', 'flow_connections.flow_id')
      .leftJoin('flow_collaborators as fc', function () {
        this.on('fc.flow_id', 'flows.id')
          .andOnNull('fc.deleted_at')
          .andOnVal('fc.user_id', userId)
      })
      .where(function () {
        // direct ownership OR access through flow_connections
        this.where('connections.user_id', userId)
          .orWhere('flows.user_id', userId)
          .orWhere(function () {
            // collaborator access
            this.whereNotNull('fc.role').andWhere('fc.role', 'in', allowedRoles)
          })
      })

    this.withFlowRole(baseQuery)
    return baseQuery
  }

  withAccessibleFlowConnections({
    requiredRole,
    queryBuilder,
    trx,
  }: {
    requiredRole: IFlowCollabRole
    queryBuilder?: ExtendedQueryBuilder<FlowConnections, FlowConnections[]>
    trx?: Transaction
  }) {
    const userId = this.id
    const baseQuery = queryBuilder || FlowConnections.query(trx)
    baseQuery
      .select('flow_connections.*')
      .join('flows', 'flows.id', 'flow_connections.flow_id')

    if (requiredRole) {
      this.applyAccessibilityFilter(baseQuery, userId, requiredRole)
    }
    this.withFlowRole(baseQuery)
    return baseQuery
  }

  withAccessibleExecutions({
    requiredRole,
    queryBuilder,
    trx,
  }: {
    requiredRole: IFlowCollabRole
    queryBuilder?: ExtendedQueryBuilder<Execution, Execution[]>
    trx?: Transaction
  }) {
    const userId = this.id
    const baseQuery = queryBuilder || Execution.query(trx)
    baseQuery
      .select('executions.*')
      .join('flows', 'flows.id', 'executions.flow_id')

    this.applyAccessibilityFilter(baseQuery, userId, requiredRole)
    this.withFlowRole(baseQuery)
    return baseQuery
  }
}

export default User

import { Transaction } from 'objection'

import Base from './base'
import Connection from './connection'
import Flow from './flow'
import FlowCollaborator from './flow-collaborators'
import ExtendedQueryBuilder from './query-builder'
import User from './user'

class FlowConnections extends Base {
  flowId!: string
  connectionId!: string
  userId!: string
  connections: Connection[]
  metadata: Record<string, any>

  static tableName = 'flow_connections'

  static jsonSchema = {
    type: 'object',
    properties: {
      flowId: { type: 'string', format: 'uuid' },
      connectionId: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' },
      metadata: { type: 'object' },
    },
  }

  // Acts as a composite primary key
  static get idColumn() {
    return ['flow_id', 'connection_id', 'user_id']
  }

  static relationMappings = () => ({
    flows: {
      relation: Base.BelongsToOneRelation,
      modelClass: Flow,
      join: {
        from: `${this.tableName}.flow_id`,
        to: `${Flow.tableName}.id`,
      },
    },
    connections: {
      relation: Base.BelongsToOneRelation,
      modelClass: Connection,
      join: {
        from: `${this.tableName}.connection_id`,
        to: `${Connection.tableName}.id`,
      },
    },
    user: {
      relation: Base.BelongsToOneRelation,
      modelClass: User,
      join: {
        from: `${this.tableName}.user_id`,
        to: `${User.tableName}.id`,
      },
    },
    collaborators: {
      relation: Base.HasManyRelation,
      modelClass: FlowCollaborator,
      join: {
        from: `${this.tableName}.flow_id`,
        to: `${FlowCollaborator.tableName}.flow_id`,
      },
    },
  })

  static withAccessible({
    queryBuilder,
    userId,
    trx,
  }: {
    queryBuilder?: ExtendedQueryBuilder<FlowConnections, FlowConnections[]>
    userId: string
    trx?: Transaction
  }) {
    const baseQuery = queryBuilder || FlowConnections.query(trx)
    return baseQuery
      .join('flows', 'flow_connections.flow_id', 'flows.id')
      .where(function () {
        this.where('flows.user_id', userId).orWhereExists(function () {
          this.select('*')
            .from('flow_collaborators')
            .whereRaw('flow_collaborators.flow_id = flows.id')
            .where('flow_collaborators.user_id', userId)
            .where('flow_collaborators.role', 'editor')
            .whereNull('flow_collaborators.deleted_at')
        })
      })
  }

  /**
   * NOTE: this function only adds the connection to the flow_connections table
   * if there are collaborators for the flow
   */
  static addFlowConnection = async ({
    flowId,
    connectionId,
    userId,
  }: {
    flowId: string
    connectionId: string
    userId: string
  }) => {
    const hasCollaborators = await FlowCollaborator.hasCollaborators({
      flowId,
    })

    if (hasCollaborators) {
      return await this.query()
        .insert({
          flowId,
          connectionId,
          userId,
        })
        .onConflict(['flow_id', 'connection_id', 'user_id'])
        .ignore()
    }
  }

  static patchFlowConnectionMetadata = async ({
    flowId,
    connectionId,
    userId,
    parameterKey,
    parameterValue,
  }: {
    flowId: string
    connectionId: string
    userId: string
    parameterKey: string
    parameterValue: string
  }) => {
    return await this.query()
      .where({
        flow_id: flowId,
        connection_id: connectionId,
        user_id: userId,
      })
      .patch({
        // ensure distinct metadata values, we do it in the query to avoid
        // having additional queries to get the array, de-duplicate and then
        // update the DB
        metadata: FlowConnections.raw(
          `
            jsonb_set(
              metadata,
              '{${parameterKey}}',
              (
                SELECT jsonb_agg(DISTINCT e)
                FROM jsonb_array_elements_text(
                COALESCE(metadata->'${parameterKey}', '[]'::jsonb) || to_jsonb(ARRAY[?]::text[])
                ) AS e
              ),
              true
            )
            `,
          [parameterValue],
        ),
      })
  }
}

export default FlowConnections

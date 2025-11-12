import { IFlowCollabRole } from '@plumber/types'

import { Transaction } from 'objection'

import Base from './base'
import Connection from './connection'
import Flow from './flow'
import FlowCollaborator from './flow-collaborators'
import TableMetadata from './table-metadata'
import User from './user'

class FlowConnections extends Base {
  flowId!: string
  // NOTE: this connection_id refers to either:
  // - the connection id of a connection in the connections table; OR
  // - the id of a Tile
  connectionId!: string
  // NOTE: addedBy is the user id of the user who added the connection to the flow
  addedBy!: string
  connectionType!: 'connection' | 'table'
  connection?: Connection
  table?: TableMetadata
  metadata: Record<string, any>

  role?: IFlowCollabRole

  static tableName = 'flow_connections'

  static jsonSchema = {
    type: 'object',
    properties: {
      flowId: { type: 'string', format: 'uuid' },
      connectionId: { type: 'string', format: 'uuid' },
      addedBy: { type: 'string', format: 'uuid' },
      connectionType: { type: 'string', enum: ['connection', 'table'] },
      metadata: { type: 'object' },
    },
  }

  // Acts as a composite primary key
  static get idColumn() {
    return ['flow_id', 'connection_id']
  }

  static relationMappings = () => ({
    flow: {
      relation: Base.BelongsToOneRelation,
      modelClass: Flow,
      join: {
        from: `${this.tableName}.flow_id`,
        to: `${Flow.tableName}.id`,
      },
    },
    connection: {
      relation: Base.BelongsToOneRelation,
      modelClass: Connection,
      join: {
        from: `${this.tableName}.connection_id`,
        to: `${Connection.tableName}.id`,
      },
    },
    // When connection_id refers to a Tile table, this relation can be used
    table: {
      relation: Base.BelongsToOneRelation,
      modelClass: TableMetadata,
      join: {
        from: `${this.tableName}.connection_id`,
        to: `${TableMetadata.tableName}.id`,
      },
    },
    user: {
      relation: Base.BelongsToOneRelation,
      modelClass: User,
      join: {
        from: `${this.tableName}.added_by`,
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

  /**
   * NOTE: this function only adds the connection to the flow_connections table
   * if there are collaborators for the flow
   */
  static addFlowConnection = async ({
    flowId,
    connectionId,
    addedBy,
    connectionType,
    trx,
  }: {
    flowId: string
    connectionId: string
    addedBy: string
    connectionType: 'connection' | 'table'
    trx?: Transaction
  }) => {
    const hasCollaborators = await Flow.hasCollaborators({
      flowId,
      trx,
    })

    if (hasCollaborators) {
      // NOTE: somehow .onConflict().ignore() does not return an empty array
      // on conflict, but actually returns the row its trying to insert
      const existing = await this.query(trx).findOne({
        flow_id: flowId,
        connection_id: connectionId,
      })

      if (existing) {
        return null
      }

      return await this.query(trx)
        .insert({
          flowId,
          connectionId,
          addedBy,
          connectionType,
        })
        .onConflict(['flow_id', 'connection_id'])
        .ignore()
    }
  }

  static patchFlowConnectionMetadata = async ({
    flowId,
    connectionId,
    parameterKey,
    parameterValue,
    trx,
  }: {
    flowId: string
    connectionId: string
    parameterKey: string
    parameterValue: string
    trx?: Transaction
  }) => {
    return await this.query(trx)
      .where({
        flow_id: flowId,
        connection_id: connectionId,
      })
      .patch({
        // ensure distinct metadata values, we do it in the query to avoid
        // having additional queries to get the array, de-duplicate and then
        // update the DB
        metadata: FlowConnections.raw(
          `
            jsonb_set(
              metadata,
              ?::text[],
              (
                SELECT jsonb_agg(DISTINCT e)
                FROM jsonb_array_elements_text(
                COALESCE(metadata->?, '[]'::jsonb) || to_jsonb(ARRAY[?]::text[])
                ) AS e
              ),
              true
            )
            `,
          [`{${parameterKey}}`, parameterKey, parameterValue],
        ),
      })
  }

  /**
   * Returns the loaded connected resource (either Connection or TableMetadata), if present.
   */
  getConnection(): Connection | TableMetadata {
    if (this.connectionType === 'connection') {
      return this.connection
    }
    if (this.connectionType === 'table') {
      return this.table
    }
    throw new Error('Connection type is not valid')
  }
}

export default FlowConnections

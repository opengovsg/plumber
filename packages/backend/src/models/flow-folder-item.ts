import { Transaction } from 'objection'

import Base from './base'
import Flow from './flow'
import FlowFolder from './flow-folder'
import ExtendedQueryBuilder from './query-builder'
import User from './user'

class FlowFolderItem extends Base {
  userId!: string
  flowId!: string
  folderId!: string
  user!: User
  flow!: Flow
  folder!: FlowFolder

  static tableName = 'flow_folder_items'

  static jsonSchema = {
    type: 'object',
    required: ['userId', 'flowId', 'folderId'],

    properties: {
      userId: { type: 'string', format: 'uuid' },
      flowId: { type: 'string', format: 'uuid' },
      folderId: { type: 'string', format: 'uuid' },
    },
  }

  // Acts as a composite primary key
  static get idColumn() {
    return ['user_id', 'flow_id']
  }

  static relationMappings = () => ({
    user: {
      relation: Base.BelongsToOneRelation,
      modelClass: User,
      join: {
        from: `${this.tableName}.user_id`,
        to: `${User.tableName}.id`,
      },
    },
    flow: {
      relation: Base.BelongsToOneRelation,
      modelClass: Flow,
      join: {
        from: `${this.tableName}.flow_id`,
        to: `${Flow.tableName}.id`,
      },
    },
    folder: {
      relation: Base.BelongsToOneRelation,
      modelClass: FlowFolder,
      join: {
        from: `${this.tableName}.folder_id`,
        to: `${FlowFolder.tableName}.id`,
      },
      filter(builder: ExtendedQueryBuilder<FlowFolder>) {
        builder.whereNull('deleted_at')
      },
    },
  })

  /**
   * Upserts the (user, flow) -> folder filing.
   *
   * `folderId: null` means unfile the pipe: the existing row (if any) is
   * soft-deleted and nothing is returned.
   */
  static moveFlowToFolder = async ({
    userId,
    flowId,
    folderId,
    trx,
  }: {
    userId: string
    flowId: string
    folderId: string | null
    trx?: Transaction
  }): Promise<FlowFolderItem | null> => {
    const existingItem = await this.query(trx)
      .findOne({ user_id: userId, flow_id: flowId })
      .withSoftDeleted()

    if (folderId == null) {
      if (existingItem && !existingItem.deletedAt) {
        await existingItem.$query(trx).delete()
      }
      return null
    }

    if (existingItem) {
      return await existingItem
        .$query(trx)
        .patchAndFetch({
          folderId,
          deletedAt: null,
        })
        .withSoftDeleted()
    }

    return await this.query(trx).insert({
      userId,
      flowId,
      folderId,
    })
  }
}

export default FlowFolderItem

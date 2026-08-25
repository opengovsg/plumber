import Base from './base'
import FlowFolderItem from './flow-folder-item'
import ExtendedQueryBuilder from './query-builder'
import User from './user'

// The 6 colour tokens the frontend swatches map to. Kept here as the single
// source of truth on the backend side.
export const FLOW_FOLDER_COLORS = [
  'magenta',
  'teal',
  'slate',
  'amber',
  'red',
  'blue',
] as const

export type FlowFolderColor = (typeof FLOW_FOLDER_COLORS)[number]

class FlowFolder extends Base {
  id!: string
  userId!: string
  name!: string
  color!: FlowFolderColor
  user!: User
  items?: FlowFolderItem[]

  // Virtual field for GraphQL compatibility - not a DB column. Populated by
  // resolvers that already know the count (e.g. getFlowFolders), so the
  // FlowFolder.flowCount custom resolver can skip a fallback query.
  flowCount?: number

  static tableName = 'flow_folders'

  static jsonSchema = {
    type: 'object',
    required: ['userId', 'name', 'color'],

    properties: {
      id: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' },
      name: { type: 'string', minLength: 1, maxLength: 60 },
      color: { type: 'string', enum: [...FLOW_FOLDER_COLORS] },
    },
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
    items: {
      relation: Base.HasManyRelation,
      modelClass: FlowFolderItem,
      join: {
        from: `${this.tableName}.id`,
        to: `${FlowFolderItem.tableName}.folder_id`,
      },
      filter(builder: ExtendedQueryBuilder<FlowFolderItem>) {
        builder.whereNull('deleted_at')
      },
    },
  })
}

export default FlowFolder

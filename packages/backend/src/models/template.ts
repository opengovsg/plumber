import Base from './base'
import ExtendedQueryBuilder from './query-builder'
import Step from './step'
import User from './user'

class Template extends Base {
  id!: string
  name!: string
  description!: string
  userId!: string
  steps!: Step[]
  user!: User

  static tableName = 'templates'

  static jsonSchema = {
    type: 'object',
    required: ['name'],

    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string', minLength: 1 },
      description: { type: 'string' },
      userId: { type: 'string', format: 'uuid' },
    },
  }

  static relationMappings = () => ({
    steps: {
      relation: Base.HasManyRelation,
      modelClass: Step,
      join: {
        from: `${this.tableName}.id`,
        to: `${Step.tableName}.template_id`,
      },
      filter(builder: ExtendedQueryBuilder<Step>) {
        builder.orderBy('position', 'asc')
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
  })
}

export default Template

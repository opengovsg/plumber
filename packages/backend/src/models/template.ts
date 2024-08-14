import Base from './base'
import Flow from './flow'
import ExtendedQueryBuilder from './query-builder'
import TemplateStep from './template-step'

class Template extends Base {
  id!: string
  name!: string
  description!: string
  steps: TemplateStep[]

  static tableName = 'templates'

  static jsonSchema = {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string ' },
    },
  }

  static relationMappings = () => ({
    steps: {
      relation: Base.HasManyRelation,
      modelClass: TemplateStep,
      join: {
        from: `${this.tableName}.id`,
        to: `${TemplateStep.tableName}.template_id`,
      },
      filter(builder: ExtendedQueryBuilder<TemplateStep>) {
        builder.orderBy('position', 'asc')
      },
    },
    flows: {
      relation: Base.HasManyRelation,
      modelClass: Flow,
      join: {
        from: `${this.tableName}.id`,
        to: `${Flow.tableName}.template_id`,
      },
    },
  })
}

export default Template

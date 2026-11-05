import type { ITemplateStep } from '@plumber/types'

import Base from './base'
import Template from './template'

class TemplateStep extends Base {
  id!: string
  templateId!: string
  data!: ITemplateStep
  template!: Template

  static tableName = 'template_steps'

  static jsonSchema = {
    type: 'object',
    required: ['data'],

    properties: {
      id: { type: 'string', format: 'uuid' },
      templateId: { type: 'string', format: 'uuid' },
      data: { type: 'object' },
    },
  }

  static relationMappings = () => ({
    template: {
      relation: Base.BelongsToOneRelation,
      modelClass: Template,
      join: {
        from: `${this.tableName}.template_id`,
        to: `${Template.tableName}.id`,
      },
    },
  })
}

export default TemplateStep

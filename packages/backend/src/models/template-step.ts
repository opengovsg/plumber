import type { IJSONObject } from '@plumber/types'

import Base from './base'
import Template from './template'

class TemplateStep extends Base {
  id!: string
  name: string
  position: number
  parameters: IJSONObject
  templateId: string
  template: Template
  appKey?: string
  eventKey?: string

  static tableName = 'template_steps'

  static jsonSchema = {
    type: 'object',
    required: ['type'],

    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string', minLength: 1, maxLength: 255 },
      appKey: { type: ['string', 'null'] },
      eventKey: { type: ['string', 'null'] },
      position: { type: 'integer' },
      parameters: { type: 'object' },
      templateId: { type: ['string', 'null'], format: 'uuid' },
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

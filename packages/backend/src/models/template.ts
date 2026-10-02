import type { ITemplate } from '@plumber/types'

import { z } from 'zod'

import Base from './base'
import ExtendedQueryBuilder from './query-builder'
import TemplateStep from './template-step'
import User from './user'

class Template extends Base {
  id!: string
  name!: string
  description!: string
  userId!: string
  templateSteps!: TemplateStep[]
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
    templateSteps: {
      relation: Base.HasManyRelation,
      modelClass: TemplateStep,
      join: {
        from: `${this.tableName}.id`,
        to: `${TemplateStep.tableName}.template_id`,
      },
      filter(builder: ExtendedQueryBuilder<TemplateStep>) {
        builder.orderByRaw("(data->>'position')::int asc")
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

  static async findAllForUser(userId: string): Promise<ITemplate[]> {
    const templates = await this.query()
      .where({ user_id: userId })
      .withGraphFetched({ templateSteps: true })
      .orderBy('created_at', 'desc')
    return templates.map((template) => template.toTemplateData())
  }

  static async findOneForUser(
    userId: string,
    templateId: string,
  ): Promise<ITemplate | undefined> {
    // Postgres rejects non-uuid values for uuid columns.
    if (!z.string().uuid().safeParse(templateId).success) {
      return undefined
    }
    const template = await this.query()
      .findOne({ id: templateId, user_id: userId })
      .withGraphFetched({ templateSteps: true })
    return template?.toTemplateData()
  }

  toTemplateData(): ITemplate {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      steps: this.templateSteps.map((templateStep) => templateStep.data),
    }
  }
}

export default Template

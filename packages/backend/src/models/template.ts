import type { ITemplate } from '@plumber/types'

import { z } from 'zod'

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
      relation: Base.ManyToManyRelation,
      modelClass: Step,
      join: {
        from: `${this.tableName}.id`,
        through: {
          from: 'template_steps.template_id',
          to: 'template_steps.step_id',
        },
        to: `${Step.tableName}.id`,
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

  static async findAllForUser(userId: string): Promise<ITemplate[]> {
    const templates = await this.query()
      .where({ user_id: userId })
      .withGraphFetched({ steps: true })
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
      .withGraphFetched({ steps: true })
    return template?.toTemplateData()
  }

  toTemplateData(): ITemplate {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      steps: this.steps.map((step) => ({
        position: step.position,
        appKey: step.appKey ?? undefined,
        eventKey: step.key ?? undefined,
        parameters: step.parameters,
      })),
    }
  }
}

export default Template

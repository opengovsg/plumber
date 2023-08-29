import { IFlowConfig } from '@plumber/types'

import type { ModelOptions, QueryContext } from 'objection'
import { ValidationError } from 'objection'

import { doesActionProcessFiles } from '@/helpers/actions'

import Base from './base'
import Execution from './execution'
import ExtendedQueryBuilder from './query-builder'
import Step from './step'

class Flow extends Base {
  id!: string
  name!: string
  userId!: string
  active: boolean
  steps: Step[]
  publishedAt: string
  remoteWebhookId: string
  executions?: Execution[]

  /**
   * Null means to use default config.
   */
  config: IFlowConfig | null

  static tableName = 'flows'

  static jsonSchema = {
    type: 'object',
    required: ['name'],

    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string', minLength: 1 },
      userId: { type: 'string', format: 'uuid' },
      remoteWebhookId: { type: 'string' },
      active: { type: 'boolean' },
      config: {
        type: 'object',
        properties: {
          maxQps: {
            type: 'integer',
          },
          rejectIfOverMaxQps: {
            type: 'boolean',
          },
        },
      },
    },
  }

  static relationMappings = () => ({
    steps: {
      relation: Base.HasManyRelation,
      modelClass: Step,
      join: {
        from: 'flows.id',
        to: 'steps.flow_id',
      },
      filter(builder: ExtendedQueryBuilder<Step>) {
        builder.orderBy('position', 'asc')
      },
    },
    executions: {
      relation: Base.HasManyRelation,
      modelClass: Execution,
      join: {
        from: 'flows.id',
        to: 'executions.flow_id',
      },
    },
  })

  async lastInternalId() {
    const lastExecution = await this.$relatedQuery('executions')
      .orderBy('created_at', 'desc')
      .limit(1)
      .first()

    return lastExecution ? (lastExecution as Execution).internalId : null
  }

  async lastInternalIds(itemCount = 50) {
    const lastExecutions = await this.$relatedQuery('executions')
      .select('internal_id')
      .orderBy('created_at', 'desc')
      .limit(itemCount)

    return lastExecutions.map((execution) => execution.internalId)
  }

  async $beforeUpdate(
    opt: ModelOptions,
    queryContext: QueryContext,
  ): Promise<void> {
    await super.$beforeUpdate(opt, queryContext)

    if (!this.active) {
      return
    }

    const oldFlow = opt.old as Flow

    const incompleteStep = await oldFlow.$relatedQuery('steps').findOne({
      status: 'incomplete',
    })

    if (incompleteStep) {
      throw new ValidationError({
        message: 'All steps should be completed before updating flow status!',
        type: 'incompleteStepsError',
      })
    }

    const allSteps = await oldFlow.$relatedQuery('steps')

    if (allSteps.length < 2) {
      throw new ValidationError({
        message:
          'There should be at least one trigger and one action steps in the flow!',
        type: 'insufficientStepsError',
      })
    }

    return
  }

  async getTriggerStep(): Promise<Step> {
    return await this.$relatedQuery('steps').findOne({
      type: 'trigger',
    })
  }

  async containsFileProcessingActions(): Promise<boolean> {
    // Users are testing unpublished flows; better to assume there might be a
    // file processing action added sometime before publishing.
    if (!this.active) {
      return true
    }

    const actionSteps = await this.$relatedQuery('steps').where(
      'type',
      'action',
    )

    const actionFileFlags = await Promise.all(
      actionSteps.map(
        async (step) => await doesActionProcessFiles(step.appKey, step.key),
      ),
    )

    return actionFileFlags.some(Boolean)
  }
}

export default Flow

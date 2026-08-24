import { IFlowCollabRole, IFlowConfig } from '@plumber/types'
import type { ModelOptions, QueryContext, Transaction } from 'objection'
import { ValidationError } from 'objection'

import { BadUserInputError, ForbiddenError } from '@/errors/graphql-errors'
import { doesActionProcessFiles } from '@/helpers/actions'

import Base from './base'
import Execution from './execution'
import FlowCollaborator from './flow-collaborators'
import FlowConnections from './flow-connections'
import FlowTransfer from './flow-transfers'
import ExtendedQueryBuilder from './query-builder'
import Step from './step'
import User from './user'

class Flow extends Base {
  id!: string
  name!: string
  userId!: string
  active: boolean
  steps: Step[]
  publishedAt: string
  remoteWebhookId: string
  executions?: Execution[]
  testExecutionId: string
  testExecution?: Execution
  user: User
  collaborators?: FlowCollaborator[]
  updatedBy?: string

  // for typescript support when creating FlowCollaborator row in insertGraph
  role?: IFlowCollabRole
  lastAccessedAt?: string

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
      updatedBy: { type: 'string', format: 'uuid' },

      config: {
        type: 'object',
        properties: {
          maxQps: {
            type: 'integer',
          },
          rejectIfOverMaxQps: {
            type: 'boolean',
          },
          errorConfig: {
            type: 'object',
            properties: {
              notificationFrequency: {
                type: 'string',
              },
              notificationRecipients: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['editor', 'viewer'],
                },
              },
            },
          },
          isForceClogged: {
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
        from: `${this.tableName}.id`,
        to: `${Execution.tableName}.flow_id`,
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
    pendingTransfer: {
      relation: Base.BelongsToOneRelation,
      modelClass: FlowTransfer,
      join: {
        from: `${this.tableName}.id`,
        to: `${FlowTransfer.tableName}.flow_id`,
      },
      filter(builder: ExtendedQueryBuilder<FlowTransfer>) {
        builder.where('status', 'pending')
      },
    },
    testExecution: {
      relation: Base.BelongsToOneRelation,
      modelClass: Execution,
      join: {
        from: `${this.tableName}.test_execution_id`,
        to: `${Execution.tableName}.id`,
      },
    },
    collaborators: {
      relation: Base.HasManyRelation,
      modelClass: FlowCollaborator,
      join: {
        from: `${this.tableName}.id`,
        to: `${FlowCollaborator.tableName}.flow_id`,
      },
      filter(builder: ExtendedQueryBuilder<FlowCollaborator>) {
        builder.whereNull('deleted_at')
      },
    },
    flowConnections: {
      relation: Base.HasManyRelation,
      modelClass: FlowConnections,
      join: {
        from: `${this.tableName}.id`,
        to: `${FlowConnections.tableName}.flow_id`,
      },
    },
  })

  static hasAccess = async (
    userId: string,
    flowId: string,
  ): Promise<void | never> => {
    const flow = await this.query().findOne({
      id: flowId,
      user_id: userId,
    })

    if (!flow) {
      throw new ForbiddenError('You do not have access to this flow')
    }
  }

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
      actionSteps.map(async (step) => await doesActionProcessFiles(step)),
    )

    return actionFileFlags.some(Boolean)
  }

  static hasCollaborators = async ({
    flowId,
    trx,
  }: {
    flowId: string
    trx?: Transaction
  }) => {
    const collaborators = await FlowCollaborator.query(trx)
      .where({
        flow_id: flowId,
      })
      .whereNull('deleted_at')

    return collaborators.length > 0
  }

  async patchLastUpdated({
    flowId,
    updatedBy,
    trx,
  }: {
    flowId: string
    updatedBy: string
    trx?: Transaction
  }) {
    return await this.$query(trx).patchAndFetchById(flowId, {
      updatedAt: new Date().toISOString(),
      updatedBy,
    })
  }

  assertNotUpdatedSince(clientUpdatedAt: string, updatedBy: string) {
    const inputTimestamp = Number(clientUpdatedAt)
    const flowTimestamp = new Date(this.updatedAt).getTime()
    const flowLastUpdatedBy = this.updatedBy

    // return early if the flow was last updated by the same user
    // avoid potential issues where its a valid update by the same user
    // but the client timestamp is not updated due to race condition or network issues
    if (flowLastUpdatedBy === updatedBy) {
      return true
    }

    if (isNaN(inputTimestamp) || inputTimestamp !== flowTimestamp) {
      throw new BadUserInputError(
        'This Pipe has been edited by another user. Please refresh the page to see the latest changes and try again.',
      )
    }
  }
}

export default Flow

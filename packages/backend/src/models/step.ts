import type { IJSONObject, IStep } from '@plumber/types'

import { type StaticHookArguments, ValidationError } from 'objection'
import { URL } from 'url'

import appConfig from '@/config/app'

import App from './app'
import Base from './base'
import Connection from './connection'
import ExecutionStep from './execution-step'
import Flow from './flow'

class Step extends Base {
  id!: string
  flowId!: string
  key?: string
  appKey?: string
  type!: IStep['type']
  connectionId?: string
  status: 'incomplete' | 'completed'
  position!: number
  parameters: IJSONObject
  connection?: Connection
  flow: Flow
  executionSteps: ExecutionStep[]

  static tableName = 'steps'

  static jsonSchema = {
    type: 'object',
    required: ['type'],

    properties: {
      id: { type: 'string', format: 'uuid' },
      flowId: { type: 'string', format: 'uuid' },
      key: { type: ['string', 'null'] },
      appKey: { type: ['string', 'null'], minLength: 1, maxLength: 255 },
      type: { type: 'string', enum: ['action', 'trigger'] },
      connectionId: { type: ['string', 'null'], format: 'uuid' },
      status: {
        type: 'string',
        enum: ['incomplete', 'completed'],
        default: 'incomplete',
      },
      position: { type: 'integer' },
      parameters: { type: 'object' },
    },
  }

  static get virtualAttributes() {
    return ['iconUrl', 'webhookUrl']
  }

  static relationMappings = () => ({
    flow: {
      relation: Base.BelongsToOneRelation,
      modelClass: Flow,
      join: {
        from: 'steps.flow_id',
        to: 'flows.id',
      },
    },
    connection: {
      relation: Base.HasOneRelation,
      modelClass: Connection,
      join: {
        from: 'steps.connection_id',
        to: 'connections.id',
      },
    },
    executionSteps: {
      relation: Base.HasManyRelation,
      modelClass: ExecutionStep,
      join: {
        from: 'steps.id',
        to: 'execution_steps.step_id',
      },
    },
  })

  get iconUrl() {
    if (!this.appKey) {
      return null
    }

    return `${appConfig.baseUrl}/apps/${this.appKey}/assets/favicon.svg`
  }

  get webhookUrl() {
    if (
      !['webhook', 'formsg'].includes(this.appKey) ||
      this.type === 'action'
    ) {
      return null
    }

    const url = new URL(`/webhooks/${this.flowId}`, appConfig.webhookUrl)
    return url.toString()
  }

  get isTrigger(): boolean {
    return this.type === 'trigger'
  }

  get isAction(): boolean {
    return this.type === 'action'
  }

  async getApp() {
    if (!this.appKey) {
      return null
    }

    return await App.findOneByKey(this.appKey)
  }

  async getLastExecutionStep() {
    const lastExecutionStep = await this.$relatedQuery('executionSteps')
      .orderBy('created_at', 'desc')
      .limit(1)
      .first()
    if (lastExecutionStep?.appKey !== this.appKey) {
      return undefined
    }
    return lastExecutionStep
  }

  async getNextStep() {
    const flow = await this.$relatedQuery('flow')

    return await flow
      .$relatedQuery('steps')
      .findOne({ position: this.position + 1 })
  }

  async getTriggerCommand() {
    const { appKey, key, isTrigger } = this
    if (!isTrigger || !appKey || !key) {
      return null
    }

    const app = await App.findOneByKey(appKey)
    const command = app.triggers.find((trigger) => trigger.key === key)

    return command
  }

  async getActionCommand() {
    const { appKey, key, isAction } = this
    if (!isAction || !appKey || !key) {
      return null
    }

    const app = await App.findOneByKey(appKey)
    const command = app.actions.find((action) => action.key === key)

    return command
  }

  static async beforeUpdate(args: StaticHookArguments<Step>): Promise<void> {
    await super.beforeUpdate(args)

    // We _have_ to use asFindQuery here instead of iterating through
    // args.inputItems (like in beforeInsert), because patch queries don't
    // provide the full object - fields like flowId will be undefined.
    //
    // Luckily,  we _shouldn't_ run into the same problem as beforeInsert: patch
    // or update queries should _not_ start from the root unless we want to
    // update _all_ steps.
    const numNonDistinctActivePipes = await args
      .asFindQuery()
      .joinRelated({ flow: true })
      .where('flow.active', true)
      .resultSize()

    if (numNonDistinctActivePipes > 0) {
      throw new ValidationError({
        message: 'Cannot edit published pipe.',
        type: 'editingPublishedPipeError',
      })
    }
  }

  static async beforeInsert(args: StaticHookArguments<Step>): Promise<void> {
    await super.beforeInsert(args)

    // Footgun: we avoid asFindQuery because some valid inserts start from the
    // root (e.g. Step.query().insert(...)), which results in asFindQuery
    // returning _all_ steps in the DB.
    const numActivePipes = await Flow.query(args.transaction)
      .findByIds(args.inputItems.map((step) => step.flowId))
      .where('active', true)
      .resultSize()

    if (numActivePipes > 0) {
      throw new ValidationError({
        message: 'Cannot edit published pipe.',
        type: 'editingPublishedPipeError',
      })
    }
  }
}

export default Step

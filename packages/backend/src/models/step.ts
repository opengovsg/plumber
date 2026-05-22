import type { IJSONObject, IStep, IStepConfig } from '@plumber/types'

import {
  raw,
  RelatedQueryBuilder,
  type StaticHookArguments,
  Transaction,
  ValidationError,
} from 'objection'
import { URL } from 'url'

import apps from '@/apps'
import appConfig from '@/config/app'

import Base from './base'
import Connection from './connection'
import ExecutionStep from './execution-step'
import Flow from './flow'

export interface StepContext {
  shouldBypassBeforeUpdateHook?: boolean
}

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
  config: IStepConfig
  updatedBy?: string
  version: number

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
      version: { type: 'integer', default: 1 },
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
      !['webhook', 'formsg', 'gathersg'].includes(this.appKey) ||
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

    return apps[this.appKey]
  }

  async getLastExecutionStep({
    executionId,
    testRunOnly,
    additionalFilter,
    iteration,
  }: {
    executionId?: string
    testRunOnly?: boolean
    additionalFilter?: (qb: RelatedQueryBuilder<ExecutionStep>) => void
    iteration?: number
  }) {
    const query = this.$relatedQuery('executionSteps')
      .orderBy('created_at', 'desc')
      .limit(1)
      .where(true)
      .first()
    if (testRunOnly) {
      query.withGraphJoined('execution').andWhere('test_run', true)
    }
    if (executionId) {
      query.andWhere('execution_id', executionId)
    }
    if (additionalFilter) {
      additionalFilter(query)
    }
    if (iteration) {
      query.andWhere(
        raw(`(execution_steps.metadata ->> 'iteration')::int = ?`, [iteration]),
      )
    }
    const lastExecutionStep = await query
    if (lastExecutionStep?.appKey !== this.appKey) {
      return undefined
    }
    return lastExecutionStep
  }

  async getNextStep() {
    const flow = await this.$relatedQuery('flow')

    const nextImmediateStep = await flow
      .$relatedQuery('steps')
      .findOne({ position: this.position + 1 })

    if (!nextImmediateStep) {
      return undefined
    }

    const isCurrentStepInMrfRejectionBranch =
      this.config.approval?.branch === 'reject'
    const isNextStepInMrfRejectionBranch =
      nextImmediateStep.config.approval?.branch === 'reject'
    if (isCurrentStepInMrfRejectionBranch) {
      /**
       * If the current step is in the rejection branch, return the next step in the rejection branch
       */
      if (
        isNextStepInMrfRejectionBranch &&
        this.config.approval?.stepId ===
          nextImmediateStep.config.approval?.stepId
      ) {
        return nextImmediateStep
      }
      /**
       * If the next step is not in the rejection branch, return undefined
       */
      return undefined
    } else {
      /**
       * If the current step and next step are not in the rejection branch, return the next step
       */
      if (!isNextStepInMrfRejectionBranch) {
        return nextImmediateStep
      }

      /**
       * If the next step is in a rejection branch, skip to the next mrf action step
       */
      const nextMrfStep = await Step.query()
        .where('flow_id', flow.id)
        .andWhere('type', 'action')
        .andWhere('key', 'mrfSubmission')
        .andWhere('position', '>', nextImmediateStep.position)
        .orderBy('position', 'asc')
        .first()
      return nextMrfStep
    }
  }

  async getTriggerCommand() {
    const { appKey, key, isTrigger } = this
    if (!isTrigger || !appKey || !key) {
      return null
    }

    const command = apps[appKey].triggers.find((trigger) => trigger.key === key)

    return command
  }

  async getActionCommand() {
    const { appKey, key, isAction } = this
    if (!isAction || !appKey || !key) {
      return null
    }

    const command = apps[appKey].actions.find((action) => action.key === key)

    return command
  }

  // Reset step ordering in case of mass deletion or reordering
  static async resetStepOrdering(flowId: string, trx?: Transaction) {
    const allSteps = await Step.query(trx)
      .where('flow_id', flowId)
      .where('type', 'action')
      .orderBy('position', 'asc')

    for (let i = 0; i < allSteps.length; i++) {
      const currStep = allSteps[i]
      if (currStep.position !== i + 2) {
        await Step.query(trx)
          .findById(currStep.id)
          .patch({
            // actions start from 2 (after the trigger step)
            position: i + 2,
          })
      }
    }
  }

  static async beforeUpdate(args: StaticHookArguments<Step>): Promise<void> {
    await super.beforeUpdate(args)

    // bypass check when step error can be rectified by just updating the step parameters
    const queryContext = args.context as StepContext
    if (queryContext.shouldBypassBeforeUpdateHook) {
      return
    }

    // We _have_ to use asFindQuery here instead of iterating through
    // args.inputItems (like in beforeInsert), because patch queries don't
    // provide the full object - fields like flowId will be undefined.
    // Furthermore, we use patchAndFetchById from the root so args.items will
    // be empty.
    //
    // Luckily, we _shouldn't_ run into the same problem as beforeInsert: patch
    // or update queries should _not_ start _purely_ from the root ("purely"
    // means we exclude the ...byId() functions like patchAndFetchById; those
    // don't count as starting from the root because they filter first) unless
    // we want to update _all_ steps.
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

  /**
   * This hook transforms step parameters to ensure the frontend always receives
   * data in the latest format, even when the database contains legacy formats.
   *
   * This approach allows zero-downtime migrations without database updates.
   */
  async $afterFind(): Promise<void> {
    const app = apps[this.appKey]
    if (app?.transformStepParameters && this.key && this.parameters) {
      this.parameters = app.transformStepParameters(
        this.key,
        this.parameters,
        this.version,
      )
    }
  }
}

export default Step

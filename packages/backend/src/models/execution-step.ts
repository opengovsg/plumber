import { IJSONObject } from '@plumber/types'

import { type StaticHookArguments, ValidationError } from 'objection'

import Base from './base'
import Execution from './execution'
import Step from './step'

class ExecutionStep extends Base {
  id!: string
  executionId!: string
  stepId!: string
  dataIn!: IJSONObject
  dataOut!: IJSONObject
  errorDetails: IJSONObject
  status: 'success' | 'failure'
  appKey: string
  jobId: string
  step: Step

  static tableName = 'execution_steps'

  static jsonSchema = {
    type: 'object',

    properties: {
      id: { type: 'string', format: 'uuid' },
      executionId: { type: 'string', format: 'uuid' },
      stepId: { type: 'string' },
      dataIn: { type: ['object', 'null'] },
      dataOut: { type: ['object', 'null'] },
      status: { type: 'string', enum: ['success', 'failure'] },
      errorDetails: { type: ['object', 'null'] },
      appKey: { type: ['string', 'null'] },
      jobId: { type: ['string', 'null'] },
    },
  }

  static relationMappings = () => ({
    execution: {
      relation: Base.BelongsToOneRelation,
      modelClass: Execution,
      join: {
        from: 'execution_steps.execution_id',
        to: 'executions.id',
      },
    },
    step: {
      relation: Base.BelongsToOneRelation,
      modelClass: Step,
      join: {
        from: 'execution_steps.step_id',
        to: 'steps.id',
      },
    },
  })

  get isFailed() {
    return this.status === 'failure'
  }

  static async beforeUpdate(args: StaticHookArguments<Step>): Promise<void> {
    await super.beforeUpdate(args)

    // We _have_ to use asFindQuery here instead of iterating through
    // args.inputItems because patch queries don't
    // provide the full object - fields like flowId will be undefined.
    //
    // Luckily, we _shouldn't_ run into the same problem as beforeInsert: patch
    // or update queries should _not_ start from the root unless we want to
    // update _all_ steps.
    const numNonDistinctActivePipes = await args
      .asFindQuery()
      .joinRelated({ step: { flow: true } })
      .where('step:flow.active', true)
      .resultSize()

    if (numNonDistinctActivePipes > 0) {
      throw new ValidationError({
        message: 'Cannot edit published pipe.',
        type: 'editingPublishedPipeError',
      })
    }
  }
}

export default ExecutionStep

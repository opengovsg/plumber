import { IExecutionStepMetadata, IJSONObject } from '@plumber/types'

import { raw } from 'objection'

import appConfig from '@/config/app'

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
  metadata: IExecutionStepMetadata
  key: string
  execution?: Execution

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
      metadata: {
        type: 'object',
        properties: {
          isMock: {
            type: 'boolean',
          },
        },
      },
    },
  }

  static get virtualAttributes() {
    return ['iconUrl']
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

  get iconUrl() {
    if (!this.appKey) {
      return null
    }

    return `${appConfig.baseUrl}/apps/${this.appKey}/assets/favicon.svg`
  }

  static async getForEachExecutionSteps(executionId: string) {
    return ExecutionStep.query()
      .with('latest_steps', (builder) => {
        /**
         * NOTE: there is a known issue with knex where 'groupBy' are placed at the end of the 'unionAll' query.
         * the workaround is to unionAll both queries with 'true' to wrap the subequery.
         */
        builder
          .unionAll((qb) => {
            qb.select(
              'step_id',
              raw('max(created_at) as max_created_at'),
              raw('min(created_at) as min_created_at'),
            )
              .from('execution_steps')
              .groupBy('step_id')
              .where('execution_id', '=', executionId)
              .where(raw("metadata = '{}'::jsonb"))
              .withSoftDeleted()
          }, true)
          .unionAll((qb) => {
            qb.select(
              'step_id',
              raw('max(created_at) as max_created_at'),
              raw('min(created_at) as min_created_at'),
            )
              .from('execution_steps')
              .groupBy('step_id', raw("metadata->>'iteration'"))
              .where('execution_id', '=', executionId)
              .where(raw("metadata != '{}'::jsonb"))
              .withSoftDeleted()
          }, true)
          .withSoftDeleted()
      })
      .join('latest_steps', (builder) => {
        builder
          .on('execution_steps.step_id', '=', 'latest_steps.step_id')
          .andOn(
            'execution_steps.created_at',
            '=',
            'latest_steps.max_created_at',
          )
      })
      .select('execution_steps.*', 'min_created_at')
      .withSoftDeleted()
      .orderBy('min_created_at', 'asc')
  }

  static async getForEachExecutionState(executionId: string) {
    const executionSteps = await ExecutionStep.getForEachExecutionSteps(
      executionId,
    )
    return {
      hasLastIterationRun: executionSteps.some(
        (step) => step.metadata?.isLastIteration && step.metadata?.isLastStep,
      ),
      areAllStepsSuccessful: executionSteps.every(
        (step) => step.status === 'success',
      ),
    }
  }
}

export default ExecutionStep
